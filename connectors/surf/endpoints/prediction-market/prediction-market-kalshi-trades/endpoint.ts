import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPredictionMarketKalshiTradesQueryParams } from "./schema/inputs.ts";

/**
 * GET /prediction-market/kalshi/trades — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Kalshi Trades",
        summary: "Returns individual trade records for a Kalshi market.",
        description: "Returns individual trade records for a Kalshi market. " +
            "Filters: taker_side, min_amount, and date range. Sort: " +
            "timestamp or notional_volume_usd. Data refresh: " +
            "real-time.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/prediction-market/kalshi-trades",
        categories: ["prediction-markets"],
    },
    request: { method: "GET", path: "/prediction-market/kalshi/trades" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zPredictionMarketKalshiTradesQueryParams.extend({
                sort_by: zPredictionMarketKalshiTradesQueryParams.shape.sort_by
                    .unwrap().default("timestamp"),
                order: zPredictionMarketKalshiTradesQueryParams.shape.order
                    .unwrap().default("desc"),
                limit: zPredictionMarketKalshiTradesQueryParams.shape.limit
                    .unwrap().default(50),
                offset: zPredictionMarketKalshiTradesQueryParams.shape.offset
                    .unwrap().default(0),
            }),
        },
    },
    usage: {
        // Surf's published Heavy tier — v1 makePerCallPrice(surfCredits(4)),
        // the balance-differencing drills of 2026-08 (design D1)
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "call",
            consumes: { credit: "default", amount: 4 },
        },
    },
});
