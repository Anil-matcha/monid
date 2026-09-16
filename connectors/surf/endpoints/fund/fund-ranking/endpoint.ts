import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zFundRankingQueryParams } from "./schema/inputs.ts";

/**
 * GET /fund/ranking — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Fund Ranking",
        summary:
            "Returns top crypto VC funds ranked by tier or portfolio count.",
        description:
            "Returns top crypto VC funds ranked by tier or portfolio " +
            "count. Available metrics: tier (lower is better), " +
            "portfolio_count (number of invested projects).",
        docsUrl: "https://docs.asksurf.ai/data-api/fund/ranking",
        categories: ["company-enrichment", "funding-data"],
    },
    request: { method: "GET", path: "/fund/ranking" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zFundRankingQueryParams.extend({
                limit: zFundRankingQueryParams.shape.limit.unwrap().default(20),
                offset: zFundRankingQueryParams.shape.offset.unwrap().default(
                    0,
                ),
            }),
        },
    },
    usage: {
        // Surf's published Light tier — v1 makePerCallPrice(surfCredits(1)),
        // the balance-differencing drills of 2026-08 (design D1)
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "call",
            consumes: { credit: "default", amount: 1 },
        },
    },
});
