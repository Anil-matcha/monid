import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zExchangeCandlesQueryParams } from "./schema/inputs.ts";

/**
 * GET /exchange/candles — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Exchange Historical Candles",
        summary: "Returns persisted OHLCV candles for a covered Bithumb, " +
            "Upbit, HashKey, bitFlyer, Coinone, or Korbit spot " +
            "market.",
        description: "Returns persisted OHLCV candles for a covered Bithumb, " +
            "Upbit, HashKey, bitFlyer, Coinone, or Korbit spot " +
            "market. Intervals: 5m, 4h, and 1w. bitFlyer is " +
            "currently reliable for weekly (1w) OHLCV only. " +
            "Pagination: use from/to to bound the time range and " +
            "limit to cap returned candles. Results are ordered " +
            "newest first. Synthetic candles: include_synthetic=true " +
            "by default, so carry-forward candles for no-trade " +
            "intervals are included for continuous charts. Set " +
            "include_synthetic=false for raw exchange-only candles. " +
            "Sparse Korbit markets may rely on synthetic rows to " +
            "keep charts continuous.",
        docsUrl: "https://docs.asksurf.ai/data-api/exchange/candles",
        categories: ["token-prices"],
    },
    request: { method: "GET", path: "/exchange/candles" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zExchangeCandlesQueryParams.extend({
                interval: zExchangeCandlesQueryParams.shape.interval.unwrap()
                    .default("5m"),
                include_synthetic: zExchangeCandlesQueryParams.shape
                    .include_synthetic.unwrap().default(true),
                limit: zExchangeCandlesQueryParams.shape.limit.unwrap().default(
                    100,
                ),
                offset: zExchangeCandlesQueryParams.shape.offset.unwrap()
                    .default(0),
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
