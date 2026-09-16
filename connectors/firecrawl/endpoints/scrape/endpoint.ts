import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zScrapeBody } from "./schema/inputs.ts";

/**
 * `POST /v2/scrape` — one URL into clean, LLM-ready content.
 *
 * BILLING (design D26/D29): Firecrawl prices a scrape as a base page plus a
 * stack of per-page modifiers, every one of them gated by a field of the
 * request. The model names each modifier as its OWN component, because an
 * input-gated line the model omits makes the estimate silently wrong the
 * moment a caller uses that input — and these are not small: the `json`
 * format quintuples a scrape (verified live 2026-09-16: 1 credit plain,
 * 5 with `{type:"json"}`), and an x.com URL is 30.
 *
 * `pdf_page` is the one OUTPUT-determined line — a PDF bills 1 credit per
 * page, so the estimate cannot see it (the URL does not say whether it
 * resolves to a PDF, let alone how long) and honestly promises 0; the settle
 * reads `metadata.numPages`, offset by the page already covered by the base
 * fee. The vendor's own `creditsUsed` claim wins over the whole fold anyway
 * (provider `usage.consolidate`), so a modeling gap surfaces as
 * `usage.mismatch.derived` instead of billing wrong.
 */
export default defineEndpoint({
    meta: {
        displayName: "Firecrawl Scrape",
        summary: "Scrape one URL into clean markdown, HTML, or " +
            "schema-shaped JSON.",
        description: "Turn a single URL into clean Markdown, HTML, links, " +
            "images, a summary, or a screenshot — and add a `json` format " +
            "object to LLM-extract structured data against your own schema " +
            "or prompt. Anti-bot handling is included at no extra cost: " +
            "`proxy` defaults to 'auto', which retries with enhanced " +
            "proxies when the plain fetch is blocked, at the same price. " +
            "`maxAge` reuses a recent cached copy for a much faster " +
            "response; set 0 to force a live fetch. PDFs parse natively and " +
            "bill per PDF page. Two costs to know before choosing this " +
            "endpoint: a page answering 403 or 404 is still charged, " +
            "because the browser and proxy were already spent — check " +
            "`metadata.statusCode` before retrying a blocked URL — and the " +
            "LLM formats (`json`, `question`, `highlights`, `audio`, " +
            "`video`) each add four times the base page cost.",
        docsUrl: "https://docs.firecrawl.dev/api-reference/endpoint/scrape",
        categories: ["web-scraping"],
    },
    request: { method: "POST", path: "/scrape" },
    input: { schema: { body: zScrapeBody } },
    usage: {
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                page: {
                    kind: UsageModelKind.PER_CALL,
                    label: "page",
                    description: "the page fetch — charged whenever " +
                        "Firecrawl returns a document, including pages that " +
                        "answered 403 or 404",
                    consumes: { credit: "default", amount: 1 },
                },
                json: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "JSON extraction",
                    description: "LLM extraction via the `json` format",
                    consumes: { credit: "default", amount: 4 },
                },
                question: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "question answering",
                    description: "LLM answer via the `question` format",
                    consumes: { credit: "default", amount: 4 },
                },
                highlights: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "highlights",
                    description: "LLM passage selection via the " +
                        "`highlights` format",
                    consumes: { credit: "default", amount: 4 },
                },
                audio: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "audio extraction",
                    description: "MP3 extraction via the `audio` format",
                    consumes: { credit: "default", amount: 4 },
                },
                video: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "video extraction",
                    description: "video extraction via the `video` format",
                    consumes: { credit: "default", amount: 4 },
                },
                redact_pii: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "PII redaction",
                    description: "redaction of personal data from the " +
                        "returned markdown",
                    consumes: { credit: "default", amount: 4 },
                },
                prompt_injection_check: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "prompt-injection check",
                    description: "the opt-in `checkPromptInjection` guard on " +
                        "the `json` format",
                    consumes: { credit: "default", amount: 4 },
                },
                lockdown: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "lockdown cache read",
                    description: "cache-only serving; the vendor bills this " +
                        "surcharge on a hit and nothing on a miss",
                    consumes: { credit: "default", amount: 4 },
                },
                zero_data_retention: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "zero data retention",
                    description: "no page content persisted beyond the " +
                        "request",
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
                    description: "x.com / twitter.com URLs are served " +
                        "through the Grok API instead of a browser",
                    consumes: { credit: "default", amount: 29 },
                },
                pdf_page: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "PDF pages beyond the first",
                    description: "PDF parsing bills per page; the first is " +
                        "already covered by the base page fee",
                    consumes: { credit: "default", amount: 1 },
                },
            },
        },
        /** Every line is deducible from the request except `pdf_page`, which
         *  needs the parsed page count — a scrape URL does not say whether it
         *  resolves to a PDF, so the estimate promises 0 rather than guessing
         *  a ceiling on every HTML page (D26: deduced, never defaulted). */
        estimate: ({ data }) => {
            const body = data.input.body;
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
            const host = body.url.toLowerCase()
                .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
                .split("/")[0].split("?")[0].split("#")[0]
                .split("@").reverse()[0]
                .split(":")[0].replace(/^www\./, "");
            const isX = host === "x.com" || host === "twitter.com" ||
                host === "mobile.twitter.com";
            return {
                counts: {
                    ...(names.includes("json") ? { json: 1 } : {}),
                    ...(names.includes("question") ? { question: 1 } : {}),
                    ...(names.includes("highlights") ? { highlights: 1 } : {}),
                    ...(names.includes("audio") ? { audio: 1 } : {}),
                    ...(names.includes("video") ? { video: 1 } : {}),
                    ...(body.redactPII ? { redact_pii: 1 } : {}),
                    ...(injection ? { prompt_injection_check: 1 } : {}),
                    ...(body.lockdown === true ? { lockdown: 1 } : {}),
                    ...(body.zeroDataRetention === true
                        ? { zero_data_retention: 1 }
                        : {}),
                    ...(body.threatProtection?.mode === "normal"
                        ? { threat_protection_scan: 1 }
                        : {}),
                    ...(isX ? { x_routing: 1 } : {}),
                },
            };
        },
        /** Settle on the DELIVERED document: the modifier lines are still
         *  input-gated (they describe the work requested of this page), but
         *  they only bill when a document came back, and `pdf_page` reads the
         *  page count the parser actually produced. An empty `parsers` array
         *  opts out of per-page PDF billing entirely (flat 1 credit), so it
         *  zeroes the line. */
        evidence: ({ data, utils }) => {
            const body = data.input.body;
            const document = utils.json.optionalGet(data.output, "$.data");
            const pages = document === undefined ? 0 : 1;
            const formats = body.formats ?? [];
            const names = pages > 0
                ? formats.map((format) =>
                    typeof format === "string" ? format : format.type
                )
                : [];
            let injection = false;
            for (const format of formats) {
                if (
                    pages > 0 && typeof format !== "string" &&
                    format.type === "json" &&
                    format.checkPromptInjection === true
                ) injection = true;
            }
            const parsed = body.parsers?.length === 0
                ? 0
                : utils.json.optionalNum(
                    data.output,
                    "$.data.metadata.numPages",
                ) ?? 0;
            const extraPdfPages = Math.max(0, parsed - 1);
            const host = body.url.toLowerCase()
                .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
                .split("/")[0].split("?")[0].split("#")[0]
                .split("@").reverse()[0]
                .split(":")[0].replace(/^www\./, "");
            const isX = pages > 0 &&
                (host === "x.com" || host === "twitter.com" ||
                    host === "mobile.twitter.com");
            return {
                counts: {
                    ...(names.includes("json") ? { json: pages } : {}),
                    ...(names.includes("question") ? { question: pages } : {}),
                    ...(names.includes("highlights")
                        ? { highlights: pages }
                        : {}),
                    ...(names.includes("audio") ? { audio: pages } : {}),
                    ...(names.includes("video") ? { video: pages } : {}),
                    ...(pages > 0 && body.redactPII
                        ? { redact_pii: pages }
                        : {}),
                    ...(injection ? { prompt_injection_check: pages } : {}),
                    ...(pages > 0 && body.lockdown === true
                        ? { lockdown: pages }
                        : {}),
                    ...(pages > 0 && body.zeroDataRetention === true
                        ? { zero_data_retention: pages }
                        : {}),
                    ...(pages > 0 && body.threatProtection?.mode === "normal"
                        ? { threat_protection_scan: pages }
                        : {}),
                    ...(isX ? { x_routing: pages } : {}),
                    ...(extraPdfPages > 0 ? { pdf_page: extraPdfPages } : {}),
                },
            };
        },
    },
});
