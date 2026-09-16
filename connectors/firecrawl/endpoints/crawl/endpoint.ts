import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zCrawlBody } from "./schema/inputs.ts";

/**
 * `POST /v2/crawl` — walk a site and return clean content for every page.
 *
 * ASYNC (design D10/D21): submit returns a job id, the job is polled to a
 * terminal status, and the results ride the status body. The three Firecrawl
 * job endpoints share ONE protocol —
 *   `POST {path}`        -> {success, id, url}
 *   `GET  {path}/{id}`   -> {status, total, completed, creditsUsed, data, next?}
 *   `DELETE {path}/{id}` -> cancel
 * — and the status URL is just the submit URL plus the id, so `/crawl`,
 * `/batch/scrape` and `/agent` author BYTE-IDENTICAL lifecycle fns that
 * normalization and content-addressing intern to one fnTable entry per phase.
 * They live on the endpoints rather than the provider because a provider-level
 * `start` would be inherited by the synchronous endpoints and replace their
 * declarative execution.
 *
 * `next` is FOLLOWED rather than passed through: it is a plain Firecrawl URL
 * that needs `Authorization: Bearer <firecrawl key>`, and the caller never
 * holds that key, so handing it back would hand them a URL they cannot call —
 * a silently truncated crawl. The poll walks the chain (bounded at 20 pages)
 * and only leaves `next` in the output when that bound is hit.
 *
 * BILLING: 1 credit per page crawled, plus the same per-page modifier stack
 * `/scrape` carries — applied to EVERY page, which is what makes a `json`
 * format on a 1000-page crawl a 5000-credit run rather than a 1000-credit one.
 * `limit` is REQUIRED at the binding: the vendor's own default is 10,000
 * pages, and an estimate has to promise a bounded number before the run holds
 * credit.
 */
export default defineEndpoint({
    meta: {
        displayName: "Firecrawl Crawl",
        summary: "Crawl a whole website into clean content, page by page.",
        description: "Crawl a site from a starting URL, following links page " +
            "by page, and get clean content for every page found — a " +
            "durable job that runs for minutes over thousands of pages, " +
            "polled until done, and stoppable mid-run. `limit` is required " +
            "and caps the page count. `includePaths` and `excludePaths` " +
            "scope the walk with regex, `maxDiscoveryDepth` bounds it, and " +
            "`crawlEntireDomain`, `allowSubdomains` and `allowExternalLinks` " +
            "widen it. `scrapeOptions` applies the full per-page scrape " +
            "option set — note that its LLM formats multiply the cost of " +
            "EVERY page crawled, not just one. Each page is billed whether " +
            "or not its server answered 200.",
        docsUrl: "https://docs.firecrawl.dev/api-reference/endpoint/crawl-post",
        categories: ["web-scraping"],
    },
    request: { method: "POST", path: "/crawl" },
    input: {
        schema: {
            // PRIMARY limiting knob — required even though the vendor
            // publishes a default (10,000), so the estimate is deduced from
            // the caller's own stated cap rather than a constant (D25).
            body: zCrawlBody.required({ limit: true }),
        },
    },
    // long-running job: quick submit/poll ticks, a large whole-run budget
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
            if (
                res.status === 408 || res.status === 429 ||
                res.status === 500 || res.status === 502 ||
                res.status === 503 || res.status === 504
            ) {
                // The status LOOKUP failed, not the job. Firecrawl documents
                // exactly these six as retryable, and the job keeps running —
                // and keeps charging, since crawl and batch pages bill as they
                // complete — so declaring the RUN terminal here would abandon
                // a live job whose cost we would then absorb. RUNNING is also
                // the honest answer: we could not determine the job state.
                // `utils.http` exposes no headers, so `Retry-After` cannot be
                // honored; back the cadence off instead. Bounded by runMs.
                logger.warn("firecrawl status lookup transient", {
                    jobId,
                    status: res.status,
                });
                return { kind: "RUNNING", pollAfterMs: 30_000 };
            }
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
            // COMPLETED: hand the vendor's envelope back as it came, `next`
            // intact. We do NOT walk the chain. Firecrawl caps a response at
            // 10 MB and chunks a large job's results deliberately; stitching
            // them would put an unbounded payload through a single run, and a
            // failure mid-walk would ship a PARTIAL set as a success while
            // `completed` still billed the whole job. The caller pages with
            // firecrawl#crawl/{id} / firecrawl#batch/scrape/{id}, which are
            // FREE (reading a job consumes no credits).
            //
            // `id` is the ONE addition to the vendor's shape, and it is what
            // makes those endpoints callable: the status body does not carry
            // the job id (only the submit response does) and `next` needs a
            // credential the caller never holds. Same spelling the submit
            // response uses, so a future vendor `id` field is a no-op merge.
            return {
                kind: "COMPLETED",
                httpStatus: 200,
                output: utils.json.merge(res.body, { id: jobId }),
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
                    label: "pages crawled",
                    description: "every page Firecrawl returns a document " +
                        "for, including pages that answered 403 or 404",
                    consumes: { credit: "default", amount: 1 },
                },
                json: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "JSON extraction",
                    description: "LLM extraction on every crawled page",
                    consumes: { credit: "default", amount: 4 },
                },
                question: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "question answering",
                    description: "LLM answer on every crawled page",
                    consumes: { credit: "default", amount: 4 },
                },
                highlights: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "highlights",
                    description: "LLM passage selection on every crawled page",
                    consumes: { credit: "default", amount: 4 },
                },
                audio: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "audio extraction",
                    description: "MP3 extraction on every crawled page",
                    consumes: { credit: "default", amount: 4 },
                },
                video: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "video extraction",
                    description: "video extraction on every crawled page",
                    consumes: { credit: "default", amount: 4 },
                },
                redact_pii: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "PII redaction",
                    description: "redaction on every crawled page",
                    consumes: { credit: "default", amount: 4 },
                },
                prompt_injection_check: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "prompt-injection check",
                    description: "the `checkPromptInjection` guard on every " +
                        "crawled page",
                    consumes: { credit: "default", amount: 4 },
                },
                lockdown: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "lockdown cache read",
                    description: "cache-only serving on every crawled page",
                    consumes: { credit: "default", amount: 4 },
                },
                zero_data_retention: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "zero data retention",
                    description: "no page content persisted beyond the crawl",
                    consumes: { credit: "default", amount: 1 },
                },
                threat_protection_scan: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "threat-protection scan",
                    description: "URL risk scan requested via " +
                        "`scrapeOptions.threatProtection.mode: normal`",
                    consumes: { credit: "default", amount: 2 },
                },
                x_routing: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "X (Grok) routing",
                    description: "x.com / twitter.com pages are served " +
                        "through the Grok API instead of a browser",
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
        /** `limit` is the promise: every active line applies to every page
         *  the caller authorized. `pdf_page` stays 0 — which crawled URLs
         *  turn out to be PDFs, and how long, is the crawl's answer, not its
         *  question. */
        estimate: ({ data }) => {
            const body = data.input.body;
            const limit = body.limit;
            const scrape = body.scrapeOptions;
            const formats = scrape?.formats ?? [];
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
            const host = body.url.toLowerCase()
                .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
                .split("/")[0].split("?")[0].split("#")[0]
                .split("@").reverse()[0]
                .split(":")[0].replace(/^www\./, "");
            const isX = host === "x.com" || host === "twitter.com" ||
                host === "mobile.twitter.com";
            return {
                counts: {
                    "page": limit,
                    ...(names.includes("json") ? { json: limit } : {}),
                    ...(names.includes("question") ? { question: limit } : {}),
                    ...(names.includes("highlights")
                        ? { highlights: limit }
                        : {}),
                    ...(names.includes("audio") ? { audio: limit } : {}),
                    ...(names.includes("video") ? { video: limit } : {}),
                    ...(scrape?.redactPII ? { redact_pii: limit } : {}),
                    ...(injection ? { prompt_injection_check: limit } : {}),
                    ...(scrape?.lockdown === true ? { lockdown: limit } : {}),
                    ...(body.zeroDataRetention === true
                        ? { zero_data_retention: limit }
                        : {}),
                    ...(scrape?.threatProtection?.mode === "normal"
                        ? { threat_protection_scan: limit }
                        : {}),
                    ...(isX ? { x_routing: limit } : {}),
                },
            };
        },
        /** Settle on `completed` — the vendor's own count of pages it
         *  processed, authoritative even when the result set was paginated or
         *  truncated. `pdf_page` sums the parsed page counts the documents
         *  actually carry. */
        evidence: ({ data, utils }) => {
            const body = data.input.body;
            const rows = utils.json.optionalGet(data.output, "$.data");
            const delivered = Array.isArray(rows) ? rows.length : 0;
            const pages = utils.json.optionalNum(data.output, "$.completed") ??
                delivered;
            const scrape = body.scrapeOptions;
            const formats = scrape?.formats ?? [];
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
            if (Array.isArray(rows) && scrape?.parsers?.length !== 0) {
                for (const row of rows) {
                    const parsed = utils.json.optionalNum(
                        row,
                        "$.metadata.numPages",
                    ) ?? 0;
                    extraPdfPages += Math.max(0, parsed - 1);
                }
            }
            // X routing is counted from the DELIVERED rows, not from the seed
            // host: `allowExternalLinks` lets an ordinary seed reach x.com
            // (which the seed gate would bill at 0), and a crawl that never
            // touches x.com should not carry the line at all.
            // `metadata.sourceURL` is the URL as requested (a redirect must
            // not move the charge).
            let xPages = 0;
            if (Array.isArray(rows)) {
                for (const row of rows) {
                    const source = utils.json.optionalGet(
                        row,
                        "$.metadata.sourceURL",
                    );
                    if (typeof source !== "string") continue;
                    const host = source.toLowerCase()
                        .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
                        .split("/")[0].split("?")[0].split("#")[0]
                        .split("@").reverse()[0]
                        .split(":")[0].replace(/^www\./, "");
                    if (
                        host === "x.com" || host === "twitter.com" ||
                        host === "mobile.twitter.com"
                    ) xPages += 1;
                }
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
                    ...(scrape?.redactPII ? { redact_pii: pages } : {}),
                    ...(injection ? { prompt_injection_check: pages } : {}),
                    ...(scrape?.lockdown === true ? { lockdown: pages } : {}),
                    ...(body.zeroDataRetention === true
                        ? { zero_data_retention: pages }
                        : {}),
                    ...(scrape?.threatProtection?.mode === "normal"
                        ? { threat_protection_scan: pages }
                        : {}),
                    ...(xPages > 0 ? { x_routing: xPages } : {}),
                    ...(extraPdfPages > 0 ? { pdf_page: extraPdfPages } : {}),
                },
            };
        },
    },
});
