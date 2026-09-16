import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zHyperliquidCandlesQueryParams } from "./schema/inputs.ts";

/**
 * GET /hyperliquid/candles — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Market Candles",
        summary: "Returns market OHLCV candles for charting and " +
            "trade-review overlays, ordered by open_time ascending.",
        description: "Returns market OHLCV candles for charting and " +
            "trade-review overlays, ordered by open_time ascending. " +
            "Each row also carries trades, closed, and nullable " +
            "quote volume (null before quote-volume coverage). " +
            "symbol, from, and to are required; from/to accept Unix " +
            "seconds, ISO datetimes, or UTC dates, and candle " +
            "open_time is bounded to the half-open [from,to) window. " +
            "The requested window may contain at most 5000 candles, " +
            "so use a larger interval for long histories. The " +
            "response is market data and does not require a wallet " +
            "address.",
        categories: ["derivatives"],
    },
    request: { method: "GET", path: "/hyperliquid/candles" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zHyperliquidCandlesQueryParams.extend({
                interval: zHyperliquidCandlesQueryParams.shape.interval.unwrap()
                    .default("4h"),
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
