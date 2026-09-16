import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zCompanySearchBody } from "./schema/inputs.ts";

/**
 * POST /v1/company/search — filtered company discovery, 25 per page.
 *
 * One search credit per company RETURNED (v1 makePerResultPrice(search));
 * rides the work key like domain-enrich. The page size is fixed at 25
 * upstream (`metadata.page_size: 25`, no caller knob), so the hold is the
 * full page. `companies` answers as an ARRAY here (an object on
 * domain-enrich) — the counting reads both.
 */
export default defineEndpoint({
    meta: {
        displayName: "Search Companies",
        summary:
            "Find companies by size, industry, location, revenue, technologies; bills search credits.",
        description: "Filtered company discovery: search by name, domain, " +
            "LinkedIn URL, headcount range, location (optionally HQ-only), " +
            "industry, technologies in use (boolean equations supported), " +
            "revenue range, and founding-year window. Returns per company " +
            "the full firmographic record — overview, type, size, country, " +
            "revenue, industry, headquarters, website, logo, specialties, " +
            "technologies, locations, employee and follower counts, and " +
            "funding summary — 25 companies per page. Suited for building " +
            "target-account lists and market mapping. For known domains, " +
            "Enrich Company Domains returns the records directly.",
        docsUrl: "https://api.contactout.com/#company-search-api",
        categories: ["company-enrichment"],
        notes: [
            "One search credit per company returned; zero results cost " +
            "nothing. The page size is fixed at 25 upstream.",
            "Provide at least one search filter — upstream answers 400 to " +
            "an empty body. year_founded_to requires year_founded_from. " +
            "linkedin_url cannot be combined with other filters.",
        ],
    },
    request: { method: "POST", path: "/v1/company/search" },
    /** Sends the WORK key (design D1): the provider holds both keys, the
     *  endpoint says which one rides the `token` header. */
    auth: {
        inject: ({ data }) => ({
            ...data.request,
            headers: { ...data.request.headers, token: data.params.workApiKey },
        }),
    },
    input: { schema: { body: zCompanySearchBody } },
    usage: {
        model: {
            kind: UsageModelKind.PER_UNIT,
            unit: Unit.RESULT,
            label: "companies returned",
            description: "company records on the returned page",
            consumes: { credit: "search_work", amount: 1 },
        },
        /** The fixed 25-company page is DEDUCED from the vendor (no
         *  page_size knob; `metadata.page_size` is always 25), not a
         *  fallback. */
        estimate: () => ({ counts: { "RESULT": 25 } }),
        // source-identical to domain-enrich's evidence ⇒ one fnTable entry
        evidence: ({ data, utils }) => {
            const companies = utils.json.optionalGet(
                data.output,
                "$.companies",
            );
            const found = Array.isArray(companies)
                ? companies.length
                : companies !== undefined && companies !== null &&
                        typeof companies === "object"
                ? Object.keys(companies).length
                : 0;
            return { counts: { "RESULT": found } };
        },
    },
});
