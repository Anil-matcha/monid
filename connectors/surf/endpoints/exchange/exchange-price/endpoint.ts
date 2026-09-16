import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zExchangePriceQueryParams } from "./schema/inputs.ts";

/**
 * GET /exchange/price — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Exchange Ticker Price",
        summary: "Returns the real-time ticker for a trading pair.",
        description: "Returns the real-time ticker for a trading pair. " +
            "Included fields: last price, bid/ask, 24h high/low, 24h " +
            "volume, 24h price change. Set type=swap to query " +
            "perpetual contract prices instead of spot. For " +
            "historical price trends, use /market/price.",
        docsUrl: "https://docs.asksurf.ai/data-api/exchange/price",
        categories: ["token-prices"],
    },
    request: { method: "GET", path: "/exchange/price" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zExchangePriceQueryParams.extend({
                type: zExchangePriceQueryParams.shape.type.unwrap().default(
                    "spot",
                ),
                exchange: zExchangePriceQueryParams.shape.exchange.unwrap()
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
