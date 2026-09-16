import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPredictionMarketKalshiPricesQueryParams } from "./schema/inputs.ts";

/**
 * GET /prediction-market/kalshi/prices — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Kalshi Price History",
        summary: "Price time series for a Kalshi market with daily or " +
            "hourly OHLC data, or latest price from recent trades.",
        description: "Price time series for a Kalshi market with daily or " +
            "hourly OHLC data, or latest price from recent trades. " +
            "Data refresh: ~30 minutes.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/prediction-market/kalshi-prices",
        categories: ["prediction-markets"],
    },
    request: { method: "GET", path: "/prediction-market/kalshi/prices" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zPredictionMarketKalshiPricesQueryParams.extend({
                time_range: zPredictionMarketKalshiPricesQueryParams.shape
                    .time_range.unwrap().default("30d"),
                interval: zPredictionMarketKalshiPricesQueryParams.shape
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
