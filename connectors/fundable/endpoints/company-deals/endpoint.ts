import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { PAGE_SIZE_MAX } from "../../schema/common.ts";
import { zCompanyDealsQueryParams } from "./schema/inputs.ts";

/** GET /company/deals — a company's funding history, billed per row. */
export default defineEndpoint({
    meta: {
        displayName: "Get Company Rounds",
        summary: "Get deals for a company by identifier.",
        description: "List every funding round of one company by UUID, " +
            "domain, LinkedIn URL, or Crunchbase URL (exactly one), newest " +
            "first. Returns per deal: id, round_type, pre/extension flags, " +
            "date, created_at, total_round_raised, valuation, financings " +
            "tranches, descriptions, investor_ids, angel_investor_ids, and " +
            "source articles; meta carries total_count. Supports " +
            "pagination. Suited for funding history timelines and " +
            "investor-graph traversal from a company.",
        docsUrl: "https://docs.tryfundable.ai/api-reference/companies/deals",
        categories: ["funding-data", "company-enrichment"],
    },
    request: { method: "GET", path: "/company/deals" },
    // `page_size` REQUIRED and CAPPED at the binding (design D25; see
    // endpoints/deals/endpoint.ts for the rule) — here on queryParams.
    input: {
        schema: {
            queryParams: zCompanyDealsQueryParams.extend({
                page_size: zCompanyDealsQueryParams.shape.page_size.unwrap()
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
