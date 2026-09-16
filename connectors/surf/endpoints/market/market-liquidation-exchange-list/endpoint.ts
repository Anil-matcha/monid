import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zMarketLiquidationExchangeListQueryParams } from "./schema/inputs.ts";

/**
 * GET /market/liquidation/exchange-list — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Liquidation by Exchange",
        summary: "Returns liquidation breakdown by exchange in a single " +
            "ranked snapshot.",
        description: "Returns liquidation breakdown by exchange in a single " +
            "ranked snapshot. Included fields: total, long, and " +
            "short volumes in USD. Filters: symbol and time_range " +
            "(1h, 4h, 12h, 24h). No pagination and no interval — " +
            "this endpoint does NOT accept limit, offset, or " +
            "interval. Returns the full exchange list in one " +
            "response.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/market/liquidation-exchange-list",
        categories: ["derivatives"],
    },
    request: { method: "GET", path: "/market/liquidation/exchange-list" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zMarketLiquidationExchangeListQueryParams.extend({
                symbol: zMarketLiquidationExchangeListQueryParams.shape.symbol
                    .unwrap().default("BTC"),
                time_range: zMarketLiquidationExchangeListQueryParams.shape
                    .time_range.unwrap().default("24h"),
                sort_by: zMarketLiquidationExchangeListQueryParams.shape.sort_by
                    .unwrap().default("liquidation_usd"),
                order: zMarketLiquidationExchangeListQueryParams.shape.order
                    .unwrap().default("desc"),
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
