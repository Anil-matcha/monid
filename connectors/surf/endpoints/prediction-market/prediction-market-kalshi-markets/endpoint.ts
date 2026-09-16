import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPredictionMarketKalshiMarketsQueryParams } from "./schema/inputs.ts";

/**
 * GET /prediction-market/kalshi/markets — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Kalshi Markets",
        summary:
            "Returns Kalshi markets, optionally filtered by market_ticker.",
        description: "Returns Kalshi markets, optionally filtered by " +
            "market_ticker. Each market includes price, volume, and " +
            "status. Data refresh: ~30 minutes.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/prediction-market/kalshi-markets",
        categories: ["prediction-markets"],
    },
    request: { method: "GET", path: "/prediction-market/kalshi/markets" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zPredictionMarketKalshiMarketsQueryParams.extend({
                limit: zPredictionMarketKalshiMarketsQueryParams.shape.limit
                    .unwrap().default(20),
                offset: zPredictionMarketKalshiMarketsQueryParams.shape.offset
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
