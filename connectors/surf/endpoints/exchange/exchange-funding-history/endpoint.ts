import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zExchangeFundingHistoryQueryParams } from "./schema/inputs.ts";

/**
 * GET /exchange/funding-history — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Exchange Funding Rate History",
        summary:
            "Returns historical funding rate records for a perpetual contract.",
        description:
            "Returns historical funding rate records for a perpetual " +
            "contract. Pagination: use from to set the start time " +
            "and limit to control result count. For longer history, " +
            "pass the last returned timestamp as the next from " +
            "value. Note: not all exchanges support historical " +
            "queries via from; some only return recent data " +
            "regardless. For the latest funding rate snapshot, see " +
            "/exchange/perp?fields=funding.",
        docsUrl: "https://docs.asksurf.ai/data-api/exchange/funding-history",
        categories: ["derivatives"],
    },
    request: { method: "GET", path: "/exchange/funding-history" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zExchangeFundingHistoryQueryParams.extend({
                limit: zExchangeFundingHistoryQueryParams.shape.limit.unwrap()
                    .default(100),
                exchange: zExchangeFundingHistoryQueryParams.shape.exchange
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
