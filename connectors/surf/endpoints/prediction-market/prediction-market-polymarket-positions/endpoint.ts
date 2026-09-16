import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPredictionMarketPolymarketPositionsQueryParams } from "./schema/inputs.ts";

/**
 * GET /prediction-market/polymarket/positions — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Polymarket Wallet Positions",
        summary: "Given a specific wallet address, returns that wallet's " +
            "open positions on Polymarket markets.",
        description: "Given a specific wallet address, returns that wallet's " +
            "open positions on Polymarket markets. This is a " +
            "single-wallet lookup — you must provide the wallet " +
            "address. Not what you need?; To discover top/smart " +
            "wallets across all of Polymarket, use " +
            "polymarket-smart-money (view=positioning for aggregate " +
            "signals, view=trades for individual whale trades).; To " +
            "find top traders by PnL or volume, use " +
            "polymarket-leaderboard. Data refresh: ~30 minutes.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/prediction-market/polymarket-positions",
        categories: ["prediction-markets"],
    },
    request: { method: "GET", path: "/prediction-market/polymarket/positions" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zPredictionMarketPolymarketPositionsQueryParams.extend(
                {
                    limit: zPredictionMarketPolymarketPositionsQueryParams.shape
                        .limit.unwrap().default(50),
                    offset: zPredictionMarketPolymarketPositionsQueryParams
                        .shape.offset.unwrap().default(0),
                },
            ),
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
