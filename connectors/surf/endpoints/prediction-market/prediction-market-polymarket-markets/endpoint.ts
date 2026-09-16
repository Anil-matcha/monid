import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPredictionMarketPolymarketMarketsQueryParams } from "./schema/inputs.ts";

/**
 * GET /prediction-market/polymarket/markets — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Polymarket Markets",
        summary: "Returns Polymarket markets, filtered by market_slug, " +
            "which is REQUIRED.",
        description: "Returns Polymarket markets, filtered by market_slug, " +
            "which is REQUIRED. Each market includes side_a and " +
            "side_b outcomes. Current prices are available via " +
            "/polymarket/prices using the condition_id. Data " +
            "refresh: ~30 minutes.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/prediction-market/polymarket-markets",
        categories: ["prediction-markets"],
    },
    request: { method: "GET", path: "/prediction-market/polymarket/markets" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zPredictionMarketPolymarketMarketsQueryParams.extend({
                limit: zPredictionMarketPolymarketMarketsQueryParams.shape.limit
                    .unwrap().default(20),
                offset: zPredictionMarketPolymarketMarketsQueryParams.shape
                    .offset.unwrap().default(0),
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
