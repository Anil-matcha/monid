import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zExchangeMarketsQueryParams } from "./schema/inputs.ts";

/**
 * GET /exchange/markets — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Exchange Trading Pairs",
        summary: "Returns trading pairs available on an exchange.",
        description: "Returns trading pairs available on an exchange. " +
            "Filters: type (spot, swap, future, option) or free-text " +
            "search. Included fields: pair name, base/quote " +
            "currencies, market type, active status, and default fee " +
            "rates. Use the returned pair values as the pair " +
            "parameter in other exchange endpoints.",
        docsUrl: "https://docs.asksurf.ai/data-api/exchange/markets",
        categories: ["token-prices"],
    },
    request: { method: "GET", path: "/exchange/markets" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zExchangeMarketsQueryParams.extend({
                exchange: zExchangeMarketsQueryParams.shape.exchange.unwrap()
                    .default("binance"),
                limit: zExchangeMarketsQueryParams.shape.limit.unwrap().default(
                    100,
                ),
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
