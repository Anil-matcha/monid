import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zMarketOptionsQueryParams } from "./schema/inputs.ts";

/**
 * GET /market/options — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Options Market Data",
        summary: "Returns options market data for a symbol.",
        description: "Returns options market data for a symbol. Included " +
            "fields: open interest, volume, put/call ratio, max pain " +
            "price.",
        docsUrl: "https://docs.asksurf.ai/data-api/market/options",
        categories: ["derivatives"],
    },
    request: { method: "GET", path: "/market/options" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zMarketOptionsQueryParams.extend({
                sort_by: zMarketOptionsQueryParams.shape.sort_by.unwrap()
                    .default("volume_24h"),
                order: zMarketOptionsQueryParams.shape.order.unwrap().default(
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
