import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zMarketFearGreedQueryParams } from "./schema/inputs.ts";

/**
 * GET /market/fear-greed — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Fear & Greed Index History",
        summary: "Returns Bitcoin Fear & Greed Index history.",
        description: "Returns Bitcoin Fear & Greed Index history. Included " +
            "fields: index value (0-100), classification label, BTC " +
            "price at each data point. Sorted newest-first. Use " +
            "from/to to filter by date range.",
        docsUrl: "https://docs.asksurf.ai/data-api/market/fear-greed",
        categories: ["crypto-signals"],
    },
    request: { method: "GET", path: "/market/fear-greed" },
    input: {
        schema: {
            queryParams: zMarketFearGreedQueryParams,
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
