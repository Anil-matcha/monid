import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zPloidSearchBody } from "./schema/inputs.ts";

/**
 * `POST /v1/search` — synchronous people search over Ploid's index. A
 * `search_timeout` answer returns PARTIAL results flagged by
 * `meta.warning`, which the provider consolidate keeps in the output.
 */
export default defineEndpoint({
    meta: {
        displayName: "Search People",
        summary:
            "Search a live people index in plain English and rank up to 100 matches.",
        description: "One-shot synchronous search over a continuously " +
            "refreshed index of professional profiles. Returns ranked " +
            "matches with a relevance score and per-person name, title, " +
            "company, location, and LinkedIn URL (select which via " +
            "contents.fields), plus search_time_ms and rows_indexed. " +
            "Supports plain-English queries with optional " +
            "title/company/location filters and three retrieval modes " +
            "(instant, auto rerank, deep grading). A timed-out search " +
            "returns partial results flagged by meta.warning. Suited for " +
            "building prospect lists, sizing a persona, and low-latency " +
            "people lookup inside agent tools. Pass a result's LinkedIn " +
            "URL to /v1/enrich for profile, email, and phone.",
        docsUrl: "https://ploid.com/documentation/api/search",
        categories: ["people-enrichment"],
    },
    request: { method: "POST", path: "/v1/search" },
    // `num_results` REQUIRED at the binding (design D25 — the mirror stays
    // the faithful vendor contract, optional there): it is the estimate's
    // whole basis, so the caller states it.
    input: {
        schema: { body: zPloidSearchBody.required({ num_results: true }) },
    },
    usage: {
        /** One block per STARTED 10 returned results at 0.1 ACU — v1
         *  `searchBlocks` + `SEARCH_ACU_PER_BLOCK` (drill 2026-09-05: 5
         *  results metered 0.1); zero results bill nothing. `every: 10`
         *  is the block, the fold ceils. */
        model: {
            kind: UsageModelKind.PER_UNIT,
            unit: Unit.RESULT,
            label: "results",
            every: 10,
            consumes: { credit: "default", amount: 0.1 },
            description: "returned results, billed per started block of 10",
        },
        /** The caller-stated page IS the result promise (typed read of the
         *  pre-toRequest validated input — design D25). */
        estimate: ({ data }) => ({
            counts: { "RESULT": data.input.body.num_results },
        }),
        /** Settle counts DELIVERED rows in `data.results[]` (v1
         *  countSearchResults; absent on a body without results → 0). The
         *  vendor's `meta.credits_charged` claim cross-checks the fold. */
        evidence: ({ data, utils }) => ({
            counts: {
                "RESULT":
                    utils.json.optionalLen(data.output, "$.data.results") ??
                        0,
            },
        }),
    },
});
