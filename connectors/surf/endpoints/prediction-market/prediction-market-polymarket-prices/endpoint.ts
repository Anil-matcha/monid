import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPredictionMarketPolymarketPricesQueryParams } from "./schema/inputs.ts";

/**
 * GET /prediction-market/polymarket/prices — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Polymarket Price History",
        summary: "Simple price time series for a Polymarket market — one " +
            "price point per interval.",
        description: "Simple price time series for a Polymarket market — one " +
            "price point per interval. Use this for tracking price " +
            "trends over time. For OHLCV candlestick data " +
            "(open/high/low/close for charting libraries), use " +
            "price-ohlcv instead. Data refresh: ~30 minutes.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/prediction-market/polymarket-prices",
        categories: ["prediction-markets"],
    },
    request: { method: "GET", path: "/prediction-market/polymarket/prices" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zPredictionMarketPolymarketPricesQueryParams.extend({
                time_range: zPredictionMarketPolymarketPricesQueryParams.shape
                    .time_range.unwrap().default("30d"),
                interval: zPredictionMarketPolymarketPricesQueryParams.shape
                    .interval.unwrap().default("1d"),
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
