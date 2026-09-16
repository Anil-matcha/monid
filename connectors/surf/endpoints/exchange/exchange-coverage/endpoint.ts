import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zExchangeCoverageQueryParams } from "./schema/inputs.ts";

/**
 * GET /exchange/coverage — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Exchange Market Coverage",
        summary: "Returns covered spot markets on Bithumb, Upbit, " +
            "HashKey, bitFlyer, Coinone, and Korbit with latest " +
            "ticker metrics, candle availability, technical score, " +
            "and data status.",
        description: "Returns covered spot markets on Bithumb, Upbit, " +
            "HashKey, bitFlyer, Coinone, and Korbit with latest " +
            "ticker metrics, candle availability, technical score, " +
            "and data status. Ticker fields: latest price, 24h " +
            "open/high/low, previous close, signed 24h price and " +
            "percent change, and 24h base/quote volume when the " +
            "exchange provides them. Use the returned pair values " +
            "with /exchange/candles for historical OHLCV. Coverage " +
            "notes: bitFlyer coverage is currently strongest for " +
            "weekly (1w) OHLCV. Korbit markets can have sparse " +
            "intraday rows during no-trade periods; inspect " +
            "data_status and data_actionability before using a " +
            "market.",
        docsUrl: "https://docs.asksurf.ai/data-api/exchange/coverage",
        categories: ["token-prices"],
    },
    request: { method: "GET", path: "/exchange/coverage" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zExchangeCoverageQueryParams.extend({
                type: zExchangeCoverageQueryParams.shape.type.unwrap().default(
                    "spot",
                ),
                sort_by: zExchangeCoverageQueryParams.shape.sort_by.unwrap()
                    .default("pair"),
                order: zExchangeCoverageQueryParams.shape.order.unwrap()
                    .default("asc"),
                limit: zExchangeCoverageQueryParams.shape.limit.unwrap()
                    .default(20),
                offset: zExchangeCoverageQueryParams.shape.offset.unwrap()
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
