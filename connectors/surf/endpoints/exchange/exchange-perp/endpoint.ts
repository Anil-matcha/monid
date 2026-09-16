import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zExchangePerpQueryParams } from "./schema/inputs.ts";

/**
 * GET /exchange/perp — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Exchange Perpetual Contract Snapshot",
        summary: "Returns a perpetual futures snapshot for a trading " +
            "pair: funding rate, open interest, mark/index price.",
        description: "Returns a perpetual futures snapshot for a trading " +
            "pair: funding rate, open interest, mark/index price. " +
            "Available fields (via fields): funding — current " +
            "funding rate, next settlement, mark/index price; oi — " +
            "open interest in contracts and USD Just pass the base " +
            "pair (e.g. pair=BTC/USDT). The swap settle suffix is " +
            "added automatically from the quote currency, e.g. " +
            "BTC/USDT:USDT or BTC/USDC:USDC.",
        docsUrl: "https://docs.asksurf.ai/data-api/exchange/perp",
        categories: ["derivatives"],
    },
    request: { method: "GET", path: "/exchange/perp" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zExchangePerpQueryParams.extend({
                fields: zExchangePerpQueryParams.shape.fields.unwrap().default(
                    "funding,oi",
                ),
                exchange: zExchangePerpQueryParams.shape.exchange.unwrap()
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
