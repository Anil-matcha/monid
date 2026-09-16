import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zBatchScrapeBody } from "./schema/inputs.ts";

/**
 * `POST /v2/batch/scrape` — scrape a known list of URLs as one durable job.
 *
 * Same job protocol as `/crawl` and `/agent` (submit -> poll -> cancel, the
 * status URL being the submit URL plus the id), so the lifecycle fns here are
 * BYTE-IDENTICAL to theirs and intern to one shared fnTable entry per phase.
 *
 * BILLING: the multiplier is the CALLER'S OWN LIST, so `urls` needs no
 * tightening — a multiplier array is never tightened (D25), and its length is
 * the estimate. `x_routing` is counted PER URL rather than as a flag, because
 * a batch can mix x.com entries with ordinary ones and each x.com URL carries
 * the full +29 Grok charge; counting `urls.length × 29` for a single x.com
 * entry would over-hold by 30x, and a flag would under-hold the same amount.
 */
export default defineEndpoint({
    meta: {
        displayName: "Firecrawl Batch Scrape",
        summary: "Scrape up to hundreds of known URLs as one durable job.",
        description: "Scrape a list of URLs you already have as one job — " +
            "submitted once, processed in parallel, polled until every page " +
            "resolves, and stoppable mid-run. The full scrape option set " +
            "applies to every page: anti-bot proxy modes, caching, and the " +
            "LLM formats, which multiply the cost of every URL in the list. " +
            "`ignoreInvalidURLs` skips malformed entries instead of failing " +
            "the batch, returning them in `invalidURLs`. Each processed page " +
            "is billed whether or not its server answered 200. For URL " +
            "discovery first, run a map or crawl instead.",
        docsUrl:
            "https://docs.firecrawl.dev/api-reference/endpoint/batch-scrape",
        categories: ["web-scraping"],
    },
    request: { method: "POST", path: "/batch/scrape" },
    input: { schema: { body: zBatchScrapeBody } },
    timeouts: { requestMs: 30_000, runMs: 1_800_000, pollMs: 10_000 },
    lifecycle: {
        start: async ({ data, utils, logger }) => {
            logger.info("submitting firecrawl job", { url: data.request.url });
            const res = await utils.request();
            if (res.status < 200 || res.status >= 300) {
                // Firecrawl API error (402 payment required, 429 rate limit,
                // 400 bad input) — DATA, zero-billed by the engine.
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            const jobId = utils.json.optionalGet(res.body, "$.id");
            if (typeof jobId !== "string" || jobId === "") {
                // 2xx without a job id: the vendor promised a job we cannot
                // manage — infrastructure failure, not data.
                throw new Error("Firecrawl did not return a job id");
            }
            return { kind: "RUNNING", state: { externalRunId: jobId } };
        },
        poll: async ({ data, utils, logger }) => {
            const jobId = data.lifecycle.state.externalRunId;
            if (jobId === undefined) {
                throw Object.assign(
                    new Error("firecrawl poll without externalRunId in state"),
                    { retriable: false },
                );
            }
            const statusUrl = data.request.url + "/" +
                encodeURIComponent(jobId);
            const res = await utils.http({ method: "GET", url: statusUrl });
            if (res.status < 200 || res.status >= 300) {
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            const status = utils.json.optionalGet(res.body, "$.status");
            if (
                status === undefined || status === "scraping" ||
                status === "processing"
            ) {
                // still working — absent state carries the previous one
                // forward (design D21)
                return { kind: "RUNNING" };
            }
            if (status !== "completed") {
                // vendor-side job failure (failed / cancelled) surfaces as an
                // OURS-synthesized error status while providerHttpStatus keeps
                // the real 200 the status API answered with (design D12)
                const message = utils.json.optionalGet(res.body, "$.error");
                logger.warn("firecrawl job did not complete", {
                    jobId,
                    status: String(status),
                });
                return {
                    kind: "COMPLETED",
                    httpStatus: 500,
                    providerHttpStatus: 200,
                    output: {
                        status,
                        message: typeof message === "string" && message !== ""
                            ? message
                            : "Firecrawl job " + String(status),
                    },
                };
            }
            // `next` is an authenticated Firecrawl URL the caller cannot
            // follow, so walk the chain here and return one complete result
            // set. Bounded — a truncated run keeps `next` and says so.
            const plucked = utils.json.pluck(res.body, "$.next");
            const envelope = plucked.rest;
            const initial = utils.json.optionalGet(envelope, "$.data");
            if (!Array.isArray(initial)) {
                // single-object result (the agent shape) — never paginated
                return { kind: "COMPLETED", httpStatus: 200, output: envelope };
            }
            const rows = initial.slice();
            let cursor = plucked.value;
            let pages = 0;
            while (
                typeof cursor === "string" && cursor !== "" && pages < 20
            ) {
                const page = await utils.http({ method: "GET", url: cursor });
                if (page.status < 200 || page.status >= 300) {
                    logger.warn("firecrawl result page fetch failed", {
                        jobId,
                        status: page.status,
                    });
                    break;
                }
                const more = utils.json.optionalGet(page.body, "$.data");
                if (Array.isArray(more)) {
                    for (const row of more) rows.push(row);
                }
                cursor = utils.json.optionalGet(page.body, "$.next");
                pages += 1;
            }
            const truncated = typeof cursor === "string" && cursor !== "";
            if (truncated) {
                logger.warn("firecrawl results truncated at the page bound", {
                    jobId,
                    pages,
                });
            }
            return {
                kind: "COMPLETED",
                httpStatus: 200,
                output: utils.json.merge(envelope, {
                    data: rows,
                    ...(truncated && typeof cursor === "string"
                        ? { next: cursor }
                        : {}),
                }),
            };
        },
        stop: async ({ data, utils, logger }) => {
            const jobId = data.lifecycle.state.externalRunId;
            if (jobId === undefined) {
                throw Object.assign(
                    new Error("firecrawl stop without externalRunId in state"),
                    { retriable: false },
                );
            }
            const res = await utils.http({
                method: "DELETE",
                url: data.request.url + "/" + encodeURIComponent(jobId),
            });
            if (res.status < 200 || res.status >= 300) {
                // best-effort teardown: an already-finished job answers
                // non-2xx and there is nothing left to stop
                logger.warn("firecrawl job cancel failed (ignored)", {
                    jobId,
                    status: res.status,
                });
            }
        },
    },
    usage: {
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                page: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "pages scraped",
                    description: "every URL Firecrawl returns a document " +
                        "for, including pages that answered 403 or 404",
                    consumes: { credit: "default", amount: 1 },
                },
                json: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "JSON extraction",
                    description: "LLM extraction on every scraped page",
                    consumes: { credit: "default", amount: 4 },
                },
                question: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "question answering",
                    description: "LLM answer on every scraped page",
                    consumes: { credit: "default", amount: 4 },
                },
                highlights: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "highlights",
                    description: "LLM passage selection on every scraped page",
                    consumes: { credit: "default", amount: 4 },
                },
                audio: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "audio extraction",
                    description: "MP3 extraction on every scraped page",
                    consumes: { credit: "default", amount: 4 },
                },
                video: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "video extraction",
                    description: "video extraction on every scraped page",
                    consumes: { credit: "default", amount: 4 },
                },
                redact_pii: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "PII redaction",
                    description: "redaction on every scraped page",
                    consumes: { credit: "default", amount: 4 },
                },
                prompt_injection_check: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "prompt-injection check",
                    description: "the `checkPromptInjection` guard on every " +
                        "scraped page",
                    consumes: { credit: "default", amount: 4 },
                },
                lockdown: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "lockdown cache read",
                    description: "cache-only serving on every scraped page",
                    consumes: { credit: "default", amount: 4 },
                },
                zero_data_retention: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "zero data retention",
                    description: "no page content persisted beyond the batch",
                    consumes: { credit: "default", amount: 1 },
                },
                threat_protection_scan: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "threat-protection scan",
                    description: "URL risk scan requested via " +
                        "`threatProtection.mode: normal`",
                    consumes: { credit: "default", amount: 2 },
                },
                x_routing: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "X (Grok) routing",
                    description: "x.com / twitter.com URLs in the list are " +
                        "served through the Grok API instead of a browser",
                    consumes: { credit: "default", amount: 29 },
                },
                pdf_page: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "PDF pages beyond the first",
                    description: "PDF parsing bills per page; the first of " +
                        "each document is covered by its page fee",
                    consumes: { credit: "default", amount: 1 },
                },
            },
        },
        /** The caller's own list is the promise. `x_routing` is counted per
         *  URL — a list holding one x.com entry among ninety-nine ordinary
         *  ones owes 29 extra credits, not 29 × 100. */
        estimate: ({ data }) => {
            const body = data.input.body;
            const urls = body.urls;
            const count = urls.length;
            const formats = body.formats ?? [];
            const names = formats.map((format) =>
                typeof format === "string" ? format : format.type
            );
            let injection = false;
            for (const format of formats) {
                if (
                    typeof format !== "string" && format.type === "json" &&
                    format.checkPromptInjection === true
                ) injection = true;
            }
            let xUrls = 0;
            for (const url of urls) {
                const host = url.toLowerCase()
                    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
                    .split("/")[0].split("?")[0].split("#")[0]
                    .split("@").reverse()[0]
                    .split(":")[0].replace(/^www\./, "");
                if (
                    host === "x.com" || host === "twitter.com" ||
                    host === "mobile.twitter.com"
                ) xUrls += 1;
            }
            return {
                counts: {
                    "page": count,
                    ...(names.includes("json") ? { json: count } : {}),
                    ...(names.includes("question") ? { question: count } : {}),
                    ...(names.includes("highlights")
                        ? { highlights: count }
                        : {}),
                    ...(names.includes("audio") ? { audio: count } : {}),
                    ...(names.includes("video") ? { video: count } : {}),
                    ...(body.redactPII ? { redact_pii: count } : {}),
                    ...(injection ? { prompt_injection_check: count } : {}),
                    ...(body.lockdown === true ? { lockdown: count } : {}),
                    ...(body.zeroDataRetention === true
                        ? { zero_data_retention: count }
                        : {}),
                    ...(body.threatProtection?.mode === "normal"
                        ? { threat_protection_scan: count }
                        : {}),
                    ...(xUrls > 0 ? { x_routing: xUrls } : {}),
                },
            };
        },
        /** Settle on `completed` — the vendor's own count of pages processed,
         *  which excludes entries `ignoreInvalidURLs` dropped. */
        evidence: ({ data, utils }) => {
            const body = data.input.body;
            const rows = utils.json.optionalGet(data.output, "$.data");
            const delivered = Array.isArray(rows) ? rows.length : 0;
            const pages = utils.json.optionalNum(data.output, "$.completed") ??
                delivered;
            const formats = body.formats ?? [];
            const names = formats.map((format) =>
                typeof format === "string" ? format : format.type
            );
            let injection = false;
            for (const format of formats) {
                if (
                    typeof format !== "string" && format.type === "json" &&
                    format.checkPromptInjection === true
                ) injection = true;
            }
            let extraPdfPages = 0;
            if (Array.isArray(rows) && body.parsers?.length !== 0) {
                for (const row of rows) {
                    const parsed = utils.json.optionalNum(
                        row,
                        "$.metadata.numPages",
                    ) ?? 0;
                    extraPdfPages += Math.max(0, parsed - 1);
                }
            }
            let xUrls = 0;
            for (const url of body.urls) {
                const host = url.toLowerCase()
                    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
                    .split("/")[0].split("?")[0].split("#")[0]
                    .split("@").reverse()[0]
                    .split(":")[0].replace(/^www\./, "");
                if (
                    host === "x.com" || host === "twitter.com" ||
                    host === "mobile.twitter.com"
                ) xUrls += 1;
            }
            return {
                counts: {
                    "page": pages,
                    ...(names.includes("json") ? { json: pages } : {}),
                    ...(names.includes("question") ? { question: pages } : {}),
                    ...(names.includes("highlights")
                        ? { highlights: pages }
                        : {}),
                    ...(names.includes("audio") ? { audio: pages } : {}),
                    ...(names.includes("video") ? { video: pages } : {}),
                    ...(body.redactPII ? { redact_pii: pages } : {}),
                    ...(injection ? { prompt_injection_check: pages } : {}),
                    ...(body.lockdown === true ? { lockdown: pages } : {}),
                    ...(body.zeroDataRetention === true
                        ? { zero_data_retention: pages }
                        : {}),
                    ...(body.threatProtection?.mode === "normal"
                        ? { threat_protection_scan: pages }
                        : {}),
                    ...(pages > 0 && xUrls > 0 ? { x_routing: xUrls } : {}),
                    ...(extraPdfPages > 0 ? { pdf_page: extraPdfPages } : {}),
                },
            };
        },
    },
});
