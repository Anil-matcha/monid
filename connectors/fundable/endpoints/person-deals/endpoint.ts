import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { PAGE_SIZE_MAX } from "../../schema/common.ts";
import { zPersonDealsQueryParams } from "./schema/inputs.ts";

/** GET /person/deals — a person's investment history, billed per row. */
export default defineEndpoint({
    meta: {
        displayName: "Get Person Investments",
        summary: "Get deals a person participated in as an investor by " +
            "identifier.",
        description: "List every funding round a person joined as an angel " +
            "or as lead partner of a firm, by UUID, LinkedIn URL, " +
            "Crunchbase URL, or Twitter URL (exactly one), newest first. " +
            "Returns per deal: id, round_type, date, total_round_raised, " +
            "valuation, financings, descriptions, company_id, " +
            "investor_ids, angel_investor_ids, and source articles; meta " +
            "carries total_count. Supports pagination. Suited for angel " +
            "track-record research and partner-level deal attribution.",
        docsUrl: "https://docs.tryfundable.ai/api-reference/people/deals",
        categories: ["funding-data", "people-enrichment"],
    },
    request: { method: "GET", path: "/person/deals" },
    // `page_size` REQUIRED and CAPPED at the binding (design D25; see
    // endpoints/deals/endpoint.ts for the rule) — here on queryParams.
    input: {
        schema: {
            queryParams: zPersonDealsQueryParams.extend({
                page_size: zPersonDealsQueryParams.shape.page_size.unwrap()
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
