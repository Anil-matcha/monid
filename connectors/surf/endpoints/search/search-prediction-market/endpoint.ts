import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zSearchPredictionMarketQueryParams } from "./schema/inputs.ts";

/**
 * GET /search/prediction-market — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Search Prediction Markets",
        summary: "Browse and search prediction markets across all " +
            "supported platforms.",
        description: "Browse and search prediction markets across all " +
            "supported platforms. Filter by platform, category, " +
            "status, keyword search, and smart money direction. Each " +
            "result includes volume, open interest, trade counts, " +
            "and smart money signals. Supports single-market lookup " +
            "via condition_id or market_ticker. Data refresh: ~5 " +
            "minutes.",
        docsUrl: "https://docs.asksurf.ai/data-api/search/prediction-market",
        categories: ["prediction-markets"],
    },
    request: { method: "GET", path: "/search/prediction-market" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zSearchPredictionMarketQueryParams.extend({
                status: zSearchPredictionMarketQueryParams.shape.status.unwrap()
                    .default("active"),
                sort_by: zSearchPredictionMarketQueryParams.shape.sort_by
                    .unwrap().default("volume_7d"),
                order: zSearchPredictionMarketQueryParams.shape.order.unwrap()
                    .default("desc"),
                limit: zSearchPredictionMarketQueryParams.shape.limit.unwrap()
                    .default(20),
                offset: zSearchPredictionMarketQueryParams.shape.offset.unwrap()
                    .default(0),
            }),
        },
    },
    usage: {
        // Surf's published Heavy tier — v1 makePerCallPrice(surfCredits(4)),
        // the balance-differencing drills of 2026-08 (design D1)
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "call",
            consumes: { credit: "default", amount: 4 },
        },
    },
});
