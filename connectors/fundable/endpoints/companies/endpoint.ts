import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { PAGE_SIZE_MAX } from "../../schema/common.ts";
import { zCompaniesSearchBody } from "./schema/inputs.ts";

/** POST /companies — filtered funded-company search, billed per row. */
export default defineEndpoint({
    meta: {
        displayName: "Search Funded Companies",
        summary: "Search and filter companies with recent funding details.",
        description: "Search venture-backed companies by semantic " +
            "description (search_query), location, industry, super " +
            "category, headcount, IPO status, total raised, latest-round " +
            "type/size/date/ingestion date and investors, or batch-look-up " +
            "up to 100 domains, LinkedIn or Crunchbase URLs. Returns per " +
            "company: id, name, domain, descriptions, headcount range, " +
            "social and PitchBook/Crunchbase links, address and location " +
            "hierarchy, industries, num_funding_rounds, num_investors, " +
            "total_raised, latest valuation, all_investor_ids, and the " +
            "latest_deal with investors, angels, financings and source " +
            "articles. Supports pagination and ten sort orders. Location, " +
            "industry and super-category filters take exact permalinks — " +
            "resolve names with /location/search and /industry/search " +
            "first. Suited for building prospect lists of newly funded " +
            "startups, market maps, and CRM enrichment by domain.",
        docsUrl: "https://docs.tryfundable.ai/api-reference/companies/list",
        categories: ["funding-data", "company-enrichment"],
    },
    request: { method: "POST", path: "/companies" },
    // `page_size` REQUIRED and CAPPED at the binding (design D25; see
    // endpoints/deals/endpoint.ts for the rule).
    input: {
        schema: {
            body: zCompaniesSearchBody.extend({
                page_size: zCompaniesSearchBody.shape.page_size.unwrap()
                    .max(PAGE_SIZE_MAX),
            }),
        },
    },
    usage: {
        /** 1 credit per returned row — v1 drill (2026-09-01). Settle is
         *  inherited (provider evidence counts `data.companies`). */
        model: {
            kind: UsageModelKind.PER_UNIT,
            unit: Unit.RESULT,
            label: "rows",
            consumes: { credit: "default", amount: 1 },
        },
        estimate: ({ data }) => ({
            counts: { "RESULT": data.input.body.page_size },
        }),
    },
});
