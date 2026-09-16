import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zExchangeKlinesQueryParams } from "./schema/inputs.ts";

/**
 * GET /exchange/klines — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Exchange OHLCV Candlesticks",
        summary: "Returns OHLCV candlestick data with period summary " +
            "stats (high, low, total volume).",
        description: "Returns OHLCV candlestick data with period summary " +
            "stats (high, low, total volume). Intervals: 15 options " +
            "from 1m to 1M. Pagination: use from to set the start " +
            "time and limit to control candle count. For longer " +
            "ranges, pass the last returned candle's timestamp as " +
            "the next from value. Exchange-side limits vary " +
            "(200–1000 per request). Set type=swap to query " +
            "perpetual contract candles instead of spot.",
        docsUrl: "https://docs.asksurf.ai/data-api/exchange/klines",
        categories: ["token-prices"],
    },
    request: { method: "GET", path: "/exchange/klines" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zExchangeKlinesQueryParams.extend({
                type: zExchangeKlinesQueryParams.shape.type.unwrap().default(
                    "spot",
                ),
                interval: zExchangeKlinesQueryParams.shape.interval.unwrap()
                    .default("1h"),
                limit: zExchangeKlinesQueryParams.shape.limit.unwrap().default(
                    100,
                ),
                exchange: zExchangeKlinesQueryParams.shape.exchange.unwrap()
                    .default("binance"),
            }),
        },
    },
    usage: {
        // Surf's published Light tier — v1 makePerCallPrice(surfCredits(1)),
        // the balance-differencing drills of 2026-08 (design D1)
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "call",
            consumes: { credit: "default", amount: 1 },
        },
    },
});
