import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zSearchBody } from "./schema/inputs.ts";

/**
 * `POST /v2/search` — search the web, optionally scraping every result.
 *
 * BILLING (design D26): search itself is a BLOCK rate — 2 credits per 10
 * results, rounded up — which the model states directly as `every: 10` on a
 * PER_UNIT line (11 results ⇒ ceil(11/10) × 2 = 4, verified live against the
 * published table). End-to-end ZDR raises that block to 10 credits; per D19 a
 * rate SELECTION is a counting rule, not a model shape, so the delta rides
 * its own `zdr_search` line that the estimate populates only when
 * `enterprise` asks for it.
 *
 * Attaching `scrapeOptions` turns every returned result into a full scrape,
 * so the whole per-page modifier stack applies PER RESULT — the single
 * largest cost cliff on this endpoint, and the reason each modifier is its
 * own line rather than a lump.
 *
 * `limit` is REQUIRED at the binding: it is the primary limiting knob, and
 * the estimate has to promise a bounded number before the run holds credit.
 *
 * `x_routing` is modeled but NEVER estimated — which hosts a query returns is
 * unknowable before the search runs, so the estimate honestly promises 0 and
 * the settle counts the x.com results that actually came back.
 */
export default defineEndpoint({
    meta: {
        displayName: "Firecrawl Search",
        summary: "Search the web and optionally scrape every result.",
        description: "Run a web search and get ranked results, optionally " +
            "with each result's full page content in the same call. " +
            "`sources` selects web, images, or news; `categories` narrows to " +
            "developer, research, or PDF results; `includeDomains` / " +
            "`excludeDomains`, `tbs`, `location` and `country` shape the " +
            "result set. `limit` is required and caps the results — search " +
            "bills 2 credits per 10 results, rounded up, so 11 results cost " +
            "4. Attach `scrapeOptions` to scrape each result in the same " +
            "call; that adds the full per-page scrape cost for every result " +
            "returned, including the LLM format surcharges, so it is much " +
            "more expensive than the search alone.",
        docsUrl: "https://docs.firecrawl.dev/api-reference/endpoint/search",
        categories: ["web-search"],
    },
    request: { method: "POST", path: "/search" },
    input: {
        schema: {
            // PRIMARY limiting knob — required even though the vendor
            // publishes a default of 10, so the estimate is deduced from the
            // caller's own stated cap rather than a constant (D25).
            body: zSearchBody.required({ limit: true }),
        },
    },
    usage: {
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                search_block: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    every: 10,
                    label: "search results",
                    description: "2 credits per 10 results, rounded up",
                    consumes: { credit: "default", amount: 2 },
                },
                zdr_search: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    every: 10,
                    label: "zero-data-retention search",
                    description: "the surcharge that raises an end-to-end " +
                        "ZDR search block from 2 credits to 10",
                    consumes: { credit: "default", amount: 8 },
                },
                scraped_page: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "scraped results",
                    description: "the base page fetch for each result " +
                        "scraped via scrapeOptions",
                    consumes: { credit: "default", amount: 1 },
                },
                json: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "JSON extraction",
                    description: "LLM extraction on each scraped result",
                    consumes: { credit: "default", amount: 4 },
                },
                question: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "question answering",
                    description: "LLM answer on each scraped result",
                    consumes: { credit: "default", amount: 4 },
                },
                highlights: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "highlights",
                    description: "LLM passage selection on each scraped " +
                        "result (the `highlights` FORMAT, not the free " +
                        "search-snippet flag)",
                    consumes: { credit: "default", amount: 4 },
                },
                audio: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "audio extraction",
                    description: "MP3 extraction on each scraped result",
                    consumes: { credit: "default", amount: 4 },
                },
                video: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "video extraction",
                    description: "video extraction on each scraped result",
                    consumes: { credit: "default", amount: 4 },
                },
                redact_pii: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "PII redaction",
                    description: "redaction on each scraped result",
                    consumes: { credit: "default", amount: 4 },
                },
                prompt_injection_check: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "prompt-injection check",
                    description: "the `checkPromptInjection` guard on each " +
                        "scraped result",
                    consumes: { credit: "default", amount: 4 },
                },
                lockdown: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.PAGE,
                    label: "lockdown cache read",
                    description: "cache-only serving on each scraped result",
                    consumes: { credit: "default", amount: 4 },
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
                    description: "x.com / twitter.com results served through " +
                        "the Grok API when scraped",
                    consumes: { credit: "default", amount: 29 },
                },
            },
        },
        /** `limit` is PER SOURCE TYPE, and the vendor bills the SUMMED result
         *  count across sources — verified live 2026-09-16: `limit: 10` over
         *  `[web, news, images]` returned 30 results and charged 6 credits,
         *  where the same limit over `[web]` alone returned 10 and charged 2.
         *  So the promise is `limit × distinct sources`, which is what the
         *  settle side already counts (it sums the three arrays).
         *
         *  DISTINCT, not `sources.length`: the response is an object keyed by
         *  source name (`data.web`, `data.news`), so a duplicated entry cannot
         *  produce a second result array — counting it would inflate the hold
         *  on a caller's typo. (`indexOf` rather than `Set`, which is not a
         *  whitelisted closed-term global.)
         *
         *  `categories` does NOT multiply — the vendor documents it as a
         *  filter, so it narrows the same result set.
         *
         *  `x_routing` cannot be deduced at all (the hosts are the search's
         *  answer, not its question), so it promises 0 and settles from the
         *  delivered results. */
        estimate: ({ data }) => {
            const body = data.input.body;
            const types = (body.sources ?? []).map((source) =>
                typeof source === "string" ? source : source.type
            );
            const distinct = types.filter((type, at) =>
                types.indexOf(type) === at
            ).length;
            const limit = body.limit * Math.max(1, distinct);
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
            const scraped = scrape === undefined ? 0 : limit;
            return {
                counts: {
                    "search_block": limit,
                    ...(body.enterprise?.includes("zdr")
                        ? { zdr_search: limit }
                        : {}),
                    ...(scraped > 0 ? { scraped_page: scraped } : {}),
                    ...(scraped > 0 && names.includes("json")
                        ? { json: scraped }
                        : {}),
                    ...(scraped > 0 && names.includes("question")
                        ? { question: scraped }
                        : {}),
                    ...(scraped > 0 && names.includes("highlights")
                        ? { highlights: scraped }
                        : {}),
                    ...(scraped > 0 && names.includes("audio")
                        ? { audio: scraped }
                        : {}),
                    ...(scraped > 0 && names.includes("video")
                        ? { video: scraped }
                        : {}),
                    ...(scraped > 0 && scrape?.redactPII
                        ? { redact_pii: scraped }
                        : {}),
                    ...(scraped > 0 && injection
                        ? { prompt_injection_check: scraped }
                        : {}),
                    ...(scraped > 0 && scrape?.lockdown === true
                        ? { lockdown: scraped }
                        : {}),
                    ...(body.threatProtection?.mode === "normal"
                        ? { threat_protection_scan: limit }
                        : {}),
                },
            };
        },
        /** Settle on DELIVERED results — the three source arrays Firecrawl
         *  fills (`web`, `images`, `news`) — and count the x.com results that
         *  were actually scraped, which the estimate could not know. */
        evidence: ({ data, utils }) => {
            const body = data.input.body;
            const web = utils.json.optionalLen(data.output, "$.data.web") ?? 0;
            const images =
                utils.json.optionalLen(data.output, "$.data.images") ?? 0;
            const news = utils.json.optionalLen(data.output, "$.data.news") ??
                0;
            const results = web + images + news;
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
            const scraped = scrape === undefined ? 0 : results;
            let xResults = 0;
            for (const source of ["web", "images", "news"]) {
                const rows = utils.json.optionalGet(
                    data.output,
                    "$.data." + source,
                );
                if (!Array.isArray(rows)) continue;
                for (const row of rows) {
                    const url = utils.json.optionalGet(row, "$.url");
                    if (typeof url !== "string") continue;
                    const host = url.toLowerCase()
                        .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
                        .split("/")[0].split("?")[0].split("#")[0]
                        .split("@").reverse()[0]
                        .split(":")[0].replace(/^www\./, "");
                    if (
                        host === "x.com" || host === "twitter.com" ||
                        host === "mobile.twitter.com"
                    ) xResults += 1;
                }
            }
            return {
                counts: {
                    "search_block": results,
                    ...(body.enterprise?.includes("zdr")
                        ? { zdr_search: results }
                        : {}),
                    ...(scraped > 0 ? { scraped_page: scraped } : {}),
                    ...(scraped > 0 && names.includes("json")
                        ? { json: scraped }
                        : {}),
                    ...(scraped > 0 && names.includes("question")
                        ? { question: scraped }
                        : {}),
                    ...(scraped > 0 && names.includes("highlights")
                        ? { highlights: scraped }
                        : {}),
                    ...(scraped > 0 && names.includes("audio")
                        ? { audio: scraped }
                        : {}),
                    ...(scraped > 0 && names.includes("video")
                        ? { video: scraped }
                        : {}),
                    ...(scraped > 0 && scrape?.redactPII
                        ? { redact_pii: scraped }
                        : {}),
                    ...(scraped > 0 && injection
                        ? { prompt_injection_check: scraped }
                        : {}),
                    ...(scraped > 0 && scrape?.lockdown === true
                        ? { lockdown: scraped }
                        : {}),
                    ...(body.threatProtection?.mode === "normal"
                        ? { threat_protection_scan: results }
                        : {}),
                    ...(scraped > 0 && xResults > 0
                        ? { x_routing: xResults }
                        : {}),
                },
            };
        },
    },
});
