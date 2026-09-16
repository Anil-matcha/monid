import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zMarketPriceIndicatorQueryParams } from "./schema/inputs.ts";

/**
 * GET /market/price-indicator — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Technical Indicator",
        summary: "Returns a technical indicator for a trading pair on a " +
            "given exchange and interval.",
        description: "Returns a technical indicator for a trading pair on a " +
            "given exchange and interval. Modes: Set from/to for " +
            "time-series; Omit for latest value only " +
            "Indicator-specific tuning via options (e.g. period:7, " +
            "fast_period:8,slow_period:21,signal_period:5, " +
            "period:10,stddev:1.5). Available indicators: rsi, macd, " +
            "ema, sma, bbands, stoch, adx, atr, cci, obv, vwap, dmi, " +
            "ichimoku, supertrend.",
        docsUrl: "https://docs.asksurf.ai/data-api/market/price-indicator",
        categories: ["crypto-signals"],
    },
    request: { method: "GET", path: "/market/price-indicator" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zMarketPriceIndicatorQueryParams.extend({
                interval: zMarketPriceIndicatorQueryParams.shape.interval
                    .unwrap().default("1d"),
                exchange: zMarketPriceIndicatorQueryParams.shape.exchange
                    .unwrap().default("binance"),
            }),
        },
    },
    usage: {
        // Surf's published Standard tier — v1 makePerCallPrice(surfCredits(2)),
        // the balance-differencing drills of 2026-08 (design D1)
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "call",
            consumes: { credit: "default", amount: 2 },
        },
    },
});
