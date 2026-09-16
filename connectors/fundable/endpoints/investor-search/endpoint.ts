import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zInvestorSearchQueryParams } from "./schema/inputs.ts";

/** GET /investor/search — the cheap fuzzy resolver, flat per call. */
export default defineEndpoint({
    meta: {
        displayName: "Look Up Investor",
        summary: "Search for an investor by name, domain, LinkedIn, or " +
            "Crunchbase.",
        description: "Resolve a VC firm or institutional investor from a " +
            "fuzzy name, a domain, a LinkedIn URL, or a Crunchbase URL " +
            "(exactly one) into Fundable identity fields. Returns " +
            "candidates with id, name, guru_permalink, description, " +
            "domain, website, LinkedIn and Crunchbase links, and a " +
            "relevance_score (1 for identifier matches). Flat price per " +
            "call, charged on zero results too. Suited as the cheap first " +
            "step before the investor profile, investor deals, or " +
            "investor-id filters that need a UUID.",
        docsUrl: "https://docs.tryfundable.ai/api-reference/investors/search",
        categories: ["funding-data"],
    },
    request: { method: "GET", path: "/investor/search" },
    input: { schema: { queryParams: zInvestorSearchQueryParams } },
    usage: {
        /** 0.1 credit per call, charged on zero results — v1 drill
         *  (2026-09-01). */
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "search",
            consumes: { credit: "default", amount: 0.1 },
        },
    },
});
