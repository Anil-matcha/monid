import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPredictionMarketPolymarketSmartMoneyQueryParams } from "./schema/inputs.ts";

/**
 * GET /prediction-market/polymarket/smart-money — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Polymarket Smart Money",
        summary: "Smart wallet analytics for Polymarket markets.",
        description: "Smart wallet analytics for Polymarket markets. " +
            "view=positioning (default): Aggregate smart wallet " +
            "direction per market — net bullish/bearish signal and " +
            "conviction. view=trades: Individual $10K+ trades with " +
            "wallet address, amount, outcome, price, and wallet age. " +
            "Data refresh: ~5 minutes.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/prediction-market/polymarket-smart-money",
        categories: ["prediction-markets"],
    },
    request: {
        method: "GET",
        path: "/prediction-market/polymarket/smart-money",
    },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zPredictionMarketPolymarketSmartMoneyQueryParams
                .extend({
                    view: zPredictionMarketPolymarketSmartMoneyQueryParams.shape
                        .view.unwrap().default("positioning"),
                    sort_by: zPredictionMarketPolymarketSmartMoneyQueryParams
                        .shape.sort_by.unwrap().default(
                            "smart_wallets_involved",
                        ),
                    order: zPredictionMarketPolymarketSmartMoneyQueryParams
                        .shape.order.unwrap().default("desc"),
                    limit: zPredictionMarketPolymarketSmartMoneyQueryParams
                        .shape.limit.unwrap().default(20),
                    offset: zPredictionMarketPolymarketSmartMoneyQueryParams
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
