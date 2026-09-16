import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zCompanyQueryParams } from "./schema/inputs.ts";

/** GET /company — one company by identifier, flat per call. */
export default defineEndpoint({
    meta: {
        displayName: "Get Company Funding",
        summary: "Get company details and recent funding by identifier.",
        description: "Fetch one company by UUID, domain, LinkedIn URL, or " +
            "Crunchbase URL (exactly one). Returns name, legal_name, " +
            "domain, short and long descriptions, headcount range, " +
            "LinkedIn/Twitter/Facebook/PitchBook/Crunchbase links, address, " +
            "location hierarchy, industries, IPO status, " +
            "num_funding_rounds, num_investors, total_raised, latest " +
            "valuation and date, all_investor_ids, and the latest_deal " +
            "with type, size, investors, angels, financings and source " +
            "articles. Resolve a name into an id or domain with " +
            "/company/search first. Suited for CRM enrichment and account " +
            "research from a website domain.",
        docsUrl: "https://docs.tryfundable.ai/api-reference/companies/get",
        categories: ["funding-data", "company-enrichment"],
    },
    request: { method: "GET", path: "/company" },
    input: { schema: { queryParams: zCompanyQueryParams } },
    usage: {
        /** 1 credit per call — v1 drill (2026-09-01). */
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "lookup",
            consumes: { credit: "default", amount: 1 },
        },
    },
});
