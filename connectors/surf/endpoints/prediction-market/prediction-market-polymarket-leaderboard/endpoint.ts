import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPredictionMarketPolymarketLeaderboardQueryParams } from "./schema/inputs.ts";

/**
 * GET /prediction-market/polymarket/leaderboard — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Polymarket Leaderboard",
        summary: "Returns a ranked leaderboard of Polymarket traders by " +
            "realized PnL, volume, or trade count.",
        description: "Returns a ranked leaderboard of Polymarket traders by " +
            "realized PnL, volume, or trade count. Sortable by pnl, " +
            "volume, or trade_count. Each entry includes the wallet " +
            "address and aggregate trading statistics. Data refresh: " +
            "~5 minutes.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/prediction-market/polymarket-leaderboard",
        categories: ["prediction-markets"],
    },
    request: {
        method: "GET",
        path: "/prediction-market/polymarket/leaderboard",
    },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zPredictionMarketPolymarketLeaderboardQueryParams
                .extend({
                    sort_by: zPredictionMarketPolymarketLeaderboardQueryParams
                        .shape.sort_by.unwrap().default("pnl"),
                    order: zPredictionMarketPolymarketLeaderboardQueryParams
                        .shape.order.unwrap().default("desc"),
                    limit: zPredictionMarketPolymarketLeaderboardQueryParams
                        .shape.limit.unwrap().default(20),
                    offset: zPredictionMarketPolymarketLeaderboardQueryParams
                        .shape.offset.unwrap().default(0),
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
