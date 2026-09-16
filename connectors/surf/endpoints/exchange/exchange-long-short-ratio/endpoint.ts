import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zExchangeLongShortRatioQueryParams } from "./schema/inputs.ts";

/**
 * GET /exchange/long-short-ratio — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Exchange Long/Short Ratio History",
        summary:
            "Returns historical long/short ratio for a perpetual contract.",
        description: "Returns historical long/short ratio for a perpetual " +
            "contract. Included fields: ratio value, long account " +
            "percentage, short account percentage. Granularity: " +
            "interval supports 1h, 4h, 1d. Pagination: use from for " +
            "start time and limit for result count. For longer " +
            "history, pass the last returned timestamp as the next " +
            "from value. Note: not all exchanges support historical " +
            "queries via from; some only return recent data " +
            "regardless. Just pass the base pair (e.g. " +
            "pair=BTC/USDT). For aggregated cross-exchange " +
            "long/short ratio, see /market/futures.",
        docsUrl: "https://docs.asksurf.ai/data-api/exchange/long-short-ratio",
        categories: ["derivatives"],
    },
    request: { method: "GET", path: "/exchange/long-short-ratio" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zExchangeLongShortRatioQueryParams.extend({
                interval: zExchangeLongShortRatioQueryParams.shape.interval
                    .unwrap().default("1h"),
                limit: zExchangeLongShortRatioQueryParams.shape.limit.unwrap()
                    .default(50),
                exchange: zExchangeLongShortRatioQueryParams.shape.exchange
                    .unwrap().default("binance"),
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
