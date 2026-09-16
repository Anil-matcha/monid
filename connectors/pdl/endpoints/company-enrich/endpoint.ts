import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPdlCompanyEnrichQueryParams } from "./schema/inputs.ts";

/** GET /v5/company/enrich — one-to-one company match, one credit per match. */
export default defineEndpoint({
    meta: {
        displayName: "Enrich Company",
        summary: "Enrich a company record from a name, website, LinkedIn, " +
            "or stock ticker.",
        description: "Enrich data on a company by matching against the " +
            "People Data Labs company dataset. Input a company name, " +
            "website, LinkedIn profile, or stock ticker. Returns a " +
            "comprehensive company record with firmographics, funding, " +
            "employee counts, tech stack, social profiles, and more. " +
            "One-to-one match with a confidence likelihood score; the " +
            "record's fields sit at the top level of the response beside " +
            "status and likelihood. No match is a 404 and costs nothing.",
        docsUrl:
            "https://docs.peopledatalabs.com/docs/reference-company-enrichment-api",
        categories: ["company-enrichment"],
    },
    // GET with query parameters — the SDK's own wire form (see
    // endpoints/person-enrich/endpoint.ts).
    request: { method: "GET", path: "/v5/company/enrich" },
    input: { schema: { queryParams: zPdlCompanyEnrichQueryParams } },
    usage: {
        /** "We charge per match" — one credit per 200 (v1
         *  makePerCallPrice(0.1) = one company record) from the
         *  `company_enrich` pool (PDL's `x-call-credits-type:
         *  enrich_company`), declared on the provider. */
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "match",
            consumes: { credit: "company_enrich", amount: 1 },
        },
    },
});
