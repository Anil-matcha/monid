import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zMarketLiquidationOrderQueryParams } from "./schema/inputs.ts";

/**
 * GET /market/liquidation/order — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Large Liquidation Orders",
        summary: "Returns individual large liquidation orders above a USD " +
            "threshold (min_amount, default 10000).",
        description:
            "Returns individual large liquidation orders above a USD " +
            "threshold (min_amount, default 10000). Filters: " +
            "exchange and symbol. Pagination: limit/offset page " +
            "within a bounded, most-recent window. To page beyond " +
            "that window, shift the time range: set to to " +
            "oldest_returned_timestamp + 1 (Unix seconds) and " +
            "repeat, de-duplicating on order_id. to is exclusive " +
            "(returns rows strictly older than to), so the +1 " +
            "re-includes the boundary second; using the oldest " +
            "timestamp itself would skip any rows sharing that " +
            "second. When offset exceeds the window the response " +
            "returns an empty array with meta.empty_reason rather " +
            "than falsely claiming exhaustion. For aggregate totals " +
            "and long/short breakdown by exchange, use " +
            "/market/liquidation/exchange-list. For historical " +
            "liquidation charts, use /market/liquidation/chart.",
        docsUrl: "https://docs.asksurf.ai/data-api/market/liquidation-order",
        categories: ["derivatives"],
    },
    request: { method: "GET", path: "/market/liquidation/order" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zMarketLiquidationOrderQueryParams.extend({
                exchange: zMarketLiquidationOrderQueryParams.shape.exchange
                    .unwrap().default("Binance"),
                symbol: zMarketLiquidationOrderQueryParams.shape.symbol.unwrap()
                    .default("BTC"),
                min_amount: zMarketLiquidationOrderQueryParams.shape.min_amount
                    .unwrap().default("10000"),
                sort_by: zMarketLiquidationOrderQueryParams.shape.sort_by
                    .unwrap().default("timestamp"),
                order: zMarketLiquidationOrderQueryParams.shape.order.unwrap()
                    .default("desc"),
                limit: zMarketLiquidationOrderQueryParams.shape.limit.unwrap()
                    .default(20),
                offset: zMarketLiquidationOrderQueryParams.shape.offset.unwrap()
                    .default(0),
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
