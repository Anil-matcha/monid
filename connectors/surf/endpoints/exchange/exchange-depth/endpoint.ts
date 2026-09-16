import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zExchangeDepthQueryParams } from "./schema/inputs.ts";

/**
 * GET /exchange/depth — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Exchange Order Book Depth",
        summary: "Returns order book bid/ask levels with computed stats.",
        description: "Returns order book bid/ask levels with computed stats. " +
            "Included fields: spread, spread percentage, mid-price, " +
            "and total bid/ask depth. Use limit to control the " +
            "number of price levels (1–100, default 20). Set " +
            "type=swap to query perpetual contract order books " +
            "instead of spot.",
        docsUrl: "https://docs.asksurf.ai/data-api/exchange/depth",
        categories: ["token-prices"],
    },
    request: { method: "GET", path: "/exchange/depth" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zExchangeDepthQueryParams.extend({
                type: zExchangeDepthQueryParams.shape.type.unwrap().default(
                    "spot",
                ),
                limit: zExchangeDepthQueryParams.shape.limit.unwrap().default(
                    20,
                ),
                exchange: zExchangeDepthQueryParams.shape.exchange.unwrap()
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
