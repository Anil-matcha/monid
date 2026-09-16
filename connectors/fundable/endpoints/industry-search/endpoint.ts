import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zIndustrySearchQueryParams } from "./schema/inputs.ts";

/** GET /industry/search — the free industry permalink resolver. */
export default defineEndpoint({
    meta: {
        displayName: "Resolve Industry Permalink",
        summary: "Search industries and super categories by name — free.",
        description: "Resolve a plain-English industry name (e.g. " +
            "'fintech', 'artificial intelligence') into the exact " +
            "permalinks the deal, company, investor and people searches " +
            "require. Returns permalink, name, and industry_type (INDUSTRY " +
            "for a specific industry such as 'machine-learning'; " +
            "SUPER_CATEGORY for a broad group such as " +
            "'artificial-intelligence-e551' that includes its related " +
            "industries). Free. Suited as the mandatory first step before " +
            "any industries or super_categories filter.",
        docsUrl: "https://docs.tryfundable.ai/api-reference/industries/search",
        categories: ["funding-data"],
    },
    request: { method: "GET", path: "/industry/search" },
    input: { schema: { queryParams: zIndustrySearchQueryParams } },
    usage: {
        // FREE (designs D25/D27): 0 credits — v1 makePerCallPrice(0),
        // drill-verified "0 credits". The model alone suffices; the
        // provider consolidate's claim prunes on the vendor's own 0.
        model: { kind: UsageModelKind.FREE },
    },
});
