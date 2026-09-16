import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { PAGE_SIZE_MAX } from "../../schema/common.ts";
import { zDealsSearchBody } from "./schema/inputs.ts";

/** POST /deals — filtered funding-round search, billed per row. */
export default defineEndpoint({
    meta: {
        displayName: "Search Funding Rounds",
        summary: "Search and filter funding rounds by company, investor, " +
            "and round details.",
        description: "Search venture funding rounds with filters on round " +
            "type (Seed to Series M, SAFE, debt, grant, extension and " +
            "pre-round modifiers), size, announcement or ingestion date, " +
            "company location, industry, super category, headcount, IPO " +
            "status and total raised, and investor or angel participation. " +
            "Returns per deal: id, round_type, date, total_round_raised, " +
            "valuation, financings tranches with currency, deal " +
            "descriptions, company_id, investor_ids, angel_investor_ids, " +
            "and source articles. Supports 0-based pagination and sort by " +
            "recency or raise size. Location, industry and super-category " +
            "filters take exact permalinks — resolve names with " +
            "/location/search and /industry/search first. Suited for " +
            "tracking newly funded startups, signal-based outbound, and " +
            "market mapping.",
        docsUrl: "https://docs.tryfundable.ai/api-reference/deals/list",
        categories: ["funding-data", "company-enrichment"],
    },
    request: { method: "POST", path: "/deals" },
    // `page_size` REQUIRED and CAPPED at the binding (design D25 — the
    // mirror stays the faithful vendor contract, optional up to 500): it is
    // the estimate's whole basis, so the caller states it; the cap is the
    // v1 platform decision bounding a row-billed hold.
    input: {
        schema: {
            body: zDealsSearchBody.extend({
                page_size: zDealsSearchBody.shape.page_size.unwrap()
                    .max(PAGE_SIZE_MAX),
            }),
        },
    },
    usage: {
        /** 1 credit per returned row — v1 drill (2026-09-01): "1 credit/row;
         *  0 rows → 0 credits". Settle is inherited: the provider evidence
         *  counts `data.deals`, the provider consolidate lifts
         *  `meta.credits_used`. */
        model: {
            kind: UsageModelKind.PER_UNIT,
            unit: Unit.RESULT,
            label: "rows",
            consumes: { credit: "default", amount: 1 },
        },
        /** The caller-stated page_size IS the row promise (typed read of
         *  the pre-toRequest validated input — design D25). */
        estimate: ({ data }) => ({
            counts: { "RESULT": data.input.body.page_size },
        }),
    },
});
