import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zMarketFuturesQueryParams } from "./schema/inputs.ts";

/**
 * GET /market/futures — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Futures Market Overview",
        summary: "Returns futures market data across all tracked tokens " +
            "in a single ranked snapshot.",
        description: "Returns futures market data across all tracked tokens " +
            "in a single ranked snapshot. Included fields: open " +
            "interest, funding rate, long/short ratio, 24h volume. " +
            "Sorted by volume_24h by default — use sort_by to " +
            "change. No pagination — this endpoint returns the full " +
            "list in one response. Does NOT accept limit, offset, or " +
            "symbol; to filter to one token, look it up in the " +
            "response locally.",
        docsUrl: "https://docs.asksurf.ai/data-api/market/futures",
        categories: ["derivatives"],
    },
    request: { method: "GET", path: "/market/futures" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zMarketFuturesQueryParams.extend({
                sort_by: zMarketFuturesQueryParams.shape.sort_by.unwrap()
                    .default("volume_24h"),
                order: zMarketFuturesQueryParams.shape.order.unwrap().default(
                    "desc",
                ),
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
