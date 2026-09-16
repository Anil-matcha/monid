import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { PAGE_SIZE_MAX } from "../../schema/common.ts";
import { zInvestorDealsQueryParams } from "./schema/inputs.ts";

/** GET /investor/deals — an investor's deal history, billed per row. */
export default defineEndpoint({
    meta: {
        displayName: "Get Investor Deals",
        summary: "Get deals for an investor by identifier.",
        description: "List every funding round an investor firm " +
            "participated in, by UUID, domain, LinkedIn URL, or Crunchbase " +
            "URL (exactly one), newest first; an identifier matching " +
            "several firms (e.g. a16z) returns all of them together. " +
            "Returns per deal: id, round_type, date, total_round_raised, " +
            "valuation, financings, descriptions, company_id, " +
            "investor_ids, angel_investor_ids, and source articles; meta " +
            "carries total_count. Supports pagination. Suited for " +
            "portfolio analysis and recent-investment tracking.",
        docsUrl: "https://docs.tryfundable.ai/api-reference/investors/deals",
        categories: ["funding-data"],
    },
    request: { method: "GET", path: "/investor/deals" },
    // `page_size` REQUIRED and CAPPED at the binding (design D25; see
    // endpoints/deals/endpoint.ts for the rule) — here on queryParams.
    input: {
        schema: {
            queryParams: zInvestorDealsQueryParams.extend({
                page_size: zInvestorDealsQueryParams.shape.page_size.unwrap()
                    .max(PAGE_SIZE_MAX),
            }),
        },
    },
    usage: {
        /** 1 credit per returned row — v1 drill (2026-09-01). Settle is
         *  inherited (provider evidence counts `data.deals`). */
        model: {
            kind: UsageModelKind.PER_UNIT,
            unit: Unit.RESULT,
            label: "rows",
            consumes: { credit: "default", amount: 1 },
        },
        estimate: ({ data }) => ({
            counts: { "RESULT": data.input.queryParams.page_size },
        }),
    },
});
