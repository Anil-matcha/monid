import { defineProvider, presets } from "@shared/core";
import { z } from "zod";

/**
 * Ahrefs (ahrefs.com) — SEO and backlink intelligence, ported from
 * monid-services `adaptors/ahrefs`. Thirty-six synchronous JSON endpoints
 * on ONE wire surface: `GET https://api.ahrefs.com/v3/<path>` with query
 * parameters (Batch Analysis is the single JSON POST), Bearer auth.
 *
 * BILLING (design D1). Ahrefs bills uncached, non-free requests in API UNITS:
 * `max(50, units_per_row × rows)`, where `units_per_row` is the sum of the
 * UNIQUE fields across `select` / `where` / `order_by` (1 unit per field by
 * default; expensive fields are marked `(5 units)` / `(10 units)` / `(15 units)` in
 * each endpoint's field descriptions — the pricing rule is
 * https://docs.ahrefs.com/en/api/docs/limits-consumption, and every
 * endpoint's `Rate card:` comment sums its own fields; checked 2026-09-16).
 * Every endpoint injects a FIXED `select` list in its
 * `input.toRequest` and restricts `where` / `order_by` to that same list,
 * so its per-row cost is an authored constant — the `rows` line's
 * `consumes.amount`. The 50-unit request minimum is the second line: a
 * `minimum_top_up` of `max(0, 50 − units_per_row × rows)` units, so the
 * fold IS the vendor formula, empty result included (v1 absorbed the
 * minimum on the platform side; the doc states the vendor's card — clay
 * D3 posture — and pass-through is the broker's call).
 *
 * The actual consumption header is the vendor claim (design D2). A sync
 * lifecycle relay carries it into state for usage.consolidate. Explicit
 * zero consumption, including cache hits and free test queries, also
 * zeroes the billable quantities: the engine prunes zero credit claims,
 * so a zero claim alone would fall back to the nonzero derived charge.
 * Missing or malformed meter headers retain the documented rate-card
 * fallback; output always remains the vendor body.
 *
 * The `rows` counter is ONE generic fn every endpoint states verbatim (so
 * it interns to a single fnTable entry): Ahrefs answers `{ <collection>:
 * [...] }` for rowed reports and `{ <name>: {...} }` for single-object
 * snapshots — the first array value is the rows, an object counts one.
 * It cannot live on the provider: every doc has two metered lines, which
 * the compiler requires each doc to own.
 */
export default defineProvider({
    name: "ahrefs",
    meta: {
        displayName: "Ahrefs",
        summary:
            "SEO intelligence: backlinks, Domain Rating, keywords, SERPs, AI-answer citations.",
        description: "Ahrefs SEO intelligence for agents — the " +
            "industry-standard backlink index and Domain Rating, organic " +
            "and paid keyword reports, keyword metrics and ideas (volume, " +
            "difficulty, traffic potential), SERP overviews, bulk target " +
            "analysis, and AI-answer citation counts across ChatGPT, " +
            "Gemini, Perplexity and more. Ask for a domain's backlinks or " +
            "authority, a keyword's difficulty, or who cites a site in AI " +
            "answers; results are structured rows.",
        homepageUrl: "https://ahrefs.com",
        docsUrl: "https://docs.ahrefs.com/",
        categories: ["seo"],
        notes: [
            "Billed in Ahrefs API units: each endpoint states its units per " +
            "returned row, with a 50-unit minimum for billable requests. " +
            "Actual vendor consumption settles the bill; cache hits and " +
            "explicit zero consumption are free. Without usable cost " +
            "headers, settlement falls back to the published rate card.",
            "where and order_by accept only the endpoint's own returned " +
            "fields; a field outside that set would raise the per-row cost, " +
            "so it is rejected before the request is sent.",
            "Rowed reports return at most 100 rows per request (plan cap); " +
            "state the row budget with limit — it is what the hold is priced " +
            "from.",
        ],
    },
    auth: { inject: presets.auth.bearer() },
    request: {
        // the v3 prefix is part of the base — path prefixes survive
        // resolution by concatenation (tinyfish-akta-octen D5)
        baseUrl: "https://api.ahrefs.com/v3",
        headers: { Accept: "application/json" },
    },
    // mirrors services/workflows/endpointExecution/config.yml (ahrefs):
    // request 30s, run 60s; no pollMs — every endpoint is sync.
    timeouts: { requestMs: 30_000, runMs: 60_000 },
    lifecycle: {
        state: z.strictObject({
            actualUnits: z.number().nonnegative().optional(),
        }),
        start: async ({ utils }) => {
            const response = await utils.request();
            const raw = response.headers["x-api-units-cost-total-actual"];
            const parsed = raw !== undefined && /^\d+$/.test(raw.trim())
                ? Number(raw)
                : undefined;
            const actualUnits =
                parsed !== undefined && Number.isSafeInteger(parsed)
                    ? parsed
                    : response.headers["x-api-cache"]?.trim().toLowerCase() ===
                            "hit"
                    ? 0
                    : undefined;
            return {
                kind: "COMPLETED",
                httpStatus: response.status,
                output: response.body,
                ...(actualUnits !== undefined
                    ? { state: { data: { actualUnits } } }
                    : {}),
            };
        },
    },
    usage: {
        /** THE credit system (design D1): Ahrefs meters ONE pool of API
         *  units per workspace (a monthly allowance, `/subscription-info/
         *  limits-and-usage`), so the pool is that unit and the id is
         *  `default`. The $/unit of the plan (v1: $129 / 100k units on
         *  Lite) is the broker card's job, not the doc's. */
        credits: {
            default: {
                label: "Ahrefs API units",
                description:
                    "the workspace's monthly API-unit allowance; billable " +
                    "requests draw max(50, units per row × rows)",
            },
        },
        consolidate: ({ data, utils }) => {
            const actualUnits = utils.json.optionalGet(
                data.lifecycle?.state ?? null,
                "$.data.actualUnits",
            );
            return {
                credits: {
                    ...(typeof actualUnits === "number"
                        ? { default: actualUnits }
                        : {}),
                },
            };
        },
        // Every doc has two metered lines, so each endpoint owns its
        // estimate and states the generic evidence counter verbatim.
    },
    output: {
        /** THE error-digestion hook: Ahrefs errors are real non-2xx
         *  `{ error: string }` bodies (v1 drills). Runs only on provider
         *  errors, after zero-usage forcing; the raw body rides under
         *  `raw` — digest, never hide. */
        fromError: ({ data, utils }) => {
            const error = utils.json.optionalGet(data.output, "$.error");
            return {
                message: typeof error === "string" && error !== ""
                    ? error
                    : "Ahrefs API error",
                raw: data.output,
            };
        },
    },
});
