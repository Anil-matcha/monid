import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zMarketLiquidationChartQueryParams } from "./schema/inputs.ts";

/**
 * GET /market/liquidation/chart — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Liquidation Chart",
        summary: "Returns OHLC-style aggregated liquidation data for a " +
            "token on a specific exchange.",
        description: "Returns OHLC-style aggregated liquidation data for a " +
            "token on a specific exchange. Filters: symbol, " +
            "exchange, interval. Useful for charting liquidation " +
            "volume over time.",
        docsUrl: "https://docs.asksurf.ai/data-api/market/liquidation-chart",
        categories: ["derivatives"],
    },
    request: { method: "GET", path: "/market/liquidation/chart" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zMarketLiquidationChartQueryParams.extend({
                interval: zMarketLiquidationChartQueryParams.shape.interval
                    .unwrap().default("1h"),
                exchange: zMarketLiquidationChartQueryParams.shape.exchange
                    .unwrap().default("Binance"),
                limit: zMarketLiquidationChartQueryParams.shape.limit.unwrap()
                    .default(500),
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
