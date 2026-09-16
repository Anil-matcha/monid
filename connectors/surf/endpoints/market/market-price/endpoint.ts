import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zMarketPriceQueryParams } from "./schema/inputs.ts";

/**
 * GET /market/price — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Token Price History",
        summary: "Returns historical price data points for a token over a " +
            "specified time range.",
        description:
            "Returns historical price data points for a token over a " +
            "specified time range. Time range options: Predefined: " +
            "1d, 7d, 14d, 30d, 90d, 180d, 365d, max; Custom: use " +
            "from / to (Unix seconds or YYYY-MM-DD) Granularity is " +
            "automatic based on range: 1d → 5-minute intervals; " +
            "7d–90d → hourly; 180d+ → daily.",
        docsUrl: "https://docs.asksurf.ai/data-api/market/price",
        categories: ["token-prices"],
    },
    request: { method: "GET", path: "/market/price" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zMarketPriceQueryParams.extend({
                time_range: zMarketPriceQueryParams.shape.time_range.unwrap()
                    .default("30d"),
                currency: zMarketPriceQueryParams.shape.currency.unwrap()
                    .default("usd"),
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
