import { defineProvider, presets } from "@shared/core";

/**
 * Firecrawl — web data for agents. JSON-over-HTTP against
 * `https://api.firecrawl.dev/v2` with `Authorization: Bearer <key>`; three
 * endpoints answer synchronously (`/scrape`, `/map`, `/search`) and three run
 * as durable jobs (`/crawl`, `/batch/scrape`, `/agent`).
 *
 * Two settle fns live HERE and every endpoint inherits them (leaf-wise
 * fallback); the async lifecycle deliberately does NOT — a provider-level
 * `lifecycle.start` would be inherited by the synchronous endpoints and
 * replace their declarative execution, so the job protocol is authored on the
 * three async endpoints (identical sources intern to one fnTable entry each).
 *
 * Verified live 2026-09-16 against a real key:
 *   `/scrape`                -> data.metadata.creditsUsed  (1 plain, 5 + json)
 *   `/search`                -> creditsUsed                (top level, 2 @ limit 2)
 *   `/crawl` `/batch/scrape` -> creditsUsed                (top level of the status body)
 *   `/agent`                 -> creditsUsed                (top level of the status body)
 *   `/map`                   -> no meter at all            ({success, id, links})
 *
 * BILLING LINES NOT MODELED, and why (the D29 completeness rule asks for the
 * exclusions to be written down, because an unmodeled input-gated line makes
 * estimates silently wrong the moment a caller uses that input):
 *   - Threat-protection scan at the ACCOUNT level (+2 credits per URL) —
 *     a server-side team policy with no request field. The per-request
 *     `threatProtection.mode: "normal"` override IS modeled, since that one
 *     is input-gated.
 *   - FIRE-1 agent steps inside `actions` — usage-based, no published
 *     formula.
 *   - `lockdown` on a cache MISS bills 1 rather than 5; the estimate holds
 *     the hit ceiling and the vendor's claim settles the difference.
 *   - `x_routing` on `/search` is modeled but never ESTIMATED: which hosts a
 *     query returns is the search's answer, not its question.
 *   - `threatProtection` on `/map`: the endpoint is flat-rated and the scan
 *     basis for a call that fetches no pages is unpublished.
 *   - `threat_protection_scan` on `/search` counts DELIVERED results, which is
 *     an approximation the vendor does not confirm: Firecrawl publishes
 *     "+2 credits per URL scanned" without saying whether it scans before or
 *     after trimming to `limit`, nor whether it de-duplicates repeated URLs.
 *     No per-line scan figure is reported either (the response carries one
 *     aggregate `creditsUsed`), so there is nothing truer to read. Documented
 *     rather than guessed at: inventing a de-duplication rule the vendor has
 *     not specified would be the same mistake in the other direction, and the
 *     vendor's aggregate claim settles the run regardless.
 * Firecrawl exposes no machine-readable pricing surface, so there is no drift
 * suite for it — these pinned rates are guarded by `deno task test:live` plus
 * the per-run `usage.mismatch.derived` signal, which cross-checks every
 * modeled line against the vendor's own meter on EVERY run.
 */
export default defineProvider({
    name: "firecrawl",
    meta: {
        displayName: "Firecrawl",
        summary: "Scrape, crawl, map and search the web as clean LLM-ready " +
            "content.",
        description: "Web data for agents — turn any URL into clean " +
            "markdown, HTML, links, images, or schema-shaped JSON; crawl a " +
            "whole site as a durable job; batch-scrape a list of URLs; " +
            "search the live web with optional per-result scraping; and run " +
            "an autonomous agent that browses until it has the data you " +
            "described. Anti-bot proxies escalate automatically at no extra " +
            "cost, PDFs parse natively, and a cache serves recent pages " +
            "back in a fraction of the time.",
        homepageUrl: "https://firecrawl.dev",
        docsUrl: "https://docs.firecrawl.dev/api-reference/v2-introduction",
        categories: ["web-scraping"],
    },
    auth: { inject: presets.auth.bearer() },
    request: { baseUrl: "https://api.firecrawl.dev/v2" },
    timeouts: { requestMs: 30_000, runMs: 60_000 },
    usage: {
        /** THE credit system (design D26): Firecrawl meters in its OWN
         *  credits and its dollar rate is plan-dependent (pay-as-you-go runs
         *  $0.005/credit on Hobby down to $0.001 on Scale), so a single $
         *  rate would be fiction — the pool is credits and the conversion
         *  stays the broker card's job (owner rule 2026-09-15). */
        credits: { default: { label: "Firecrawl credits" } },
        /** The vendor's OWN claim (design D27): every billable Firecrawl
         *  response carries its exact credit draw. The field sits at the top
         *  level on `/search` and on every job status body, and nested under
         *  the page metadata on `/scrape`; `/map` carries none. Read in one
         *  motion — the bare top-level field is PLUCKED out (a receipt, not
         *  data), while `data.metadata.creditsUsed` stays put as per-page
         *  provenance next to the statusCode a caller already reads.
         *
         *  Entry OMITTED when absent (never `?? 0`), so a meterless `/map`
         *  falls back to the derived fold; a present claim WINS and the
         *  pinned per-line rates become the per-run cross-check
         *  (`usage.mismatch.derived`). */
        consolidate: ({ data, utils }) => {
            const { value, rest } = utils.json.pluck(
                data.output,
                "$.creditsUsed",
            );
            const claimed = typeof value === "number"
                ? value
                : utils.json.optionalNum(
                    data.output,
                    "$.data.metadata.creditsUsed",
                );
            return {
                credits: {
                    ...(claimed !== undefined ? { default: claimed } : {}),
                },
                output: rest,
            };
        },
    },
    output: {
        /** Firecrawl's error envelope is `{success: false, error}` plus an
         *  optional machine `code` and zod-shaped `details` (verified live:
         *  401 `{success,error}`, 400 `{success,code,error,details}`). Vendor
         *  non-2xx is DATA — the engine zero-bills it. */
        fromError: ({ data, utils }) => {
            const message = utils.json.optionalGet(data.output, "$.error");
            const code = utils.json.optionalGet(data.output, "$.code");
            return {
                message: typeof message === "string" && message !== ""
                    ? message
                    : "Firecrawl API error",
                ...(typeof code === "string" ? { code } : {}),
                raw: data.output,
            };
        },
    },
});
