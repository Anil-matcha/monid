import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zCompanySearchQueryParams } from "./schema/inputs.ts";

/** GET /company/search — the cheap fuzzy resolver, flat per call. */
export default defineEndpoint({
    meta: {
        displayName: "Look Up Company",
        summary: "Search for a company by name, domain, LinkedIn, or " +
            "Crunchbase.",
        description: "Resolve a company from a fuzzy name, a domain, a " +
            "LinkedIn URL, or a Crunchbase URL (exactly one) into Fundable " +
            "identity fields. Returns up to ten candidates with id, name, " +
            "guru_permalink, short_description, domain, LinkedIn and " +
            "Crunchbase links, and a relevance_score. Flat price per call, " +
            "charged on zero results too. Suited as the cheap first step " +
            "before the company, company-deals, or investor-filter " +
            "endpoints that need a UUID.",
        docsUrl: "https://docs.tryfundable.ai/api-reference/companies/search",
        categories: ["funding-data", "company-enrichment"],
    },
    request: { method: "GET", path: "/company/search" },
    input: { schema: { queryParams: zCompanySearchQueryParams } },
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
