import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPredictionMarketKalshiEventsQueryParams } from "./schema/inputs.ts";

/**
 * GET /prediction-market/kalshi/events — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Kalshi Events",
        summary: "Returns Kalshi events with nested markets, optionally " +
            "filtered by event_ticker.",
        description: "Returns Kalshi events with nested markets, optionally " +
            "filtered by event_ticker. Each event includes market " +
            "count and a list of markets. Data refresh: ~30 minutes.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/prediction-market/kalshi-events",
        categories: ["prediction-markets"],
    },
    request: { method: "GET", path: "/prediction-market/kalshi/events" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zPredictionMarketKalshiEventsQueryParams.extend({
                limit: zPredictionMarketKalshiEventsQueryParams.shape.limit
                    .unwrap().default(20),
                offset: zPredictionMarketKalshiEventsQueryParams.shape.offset
                    .unwrap().default(0),
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
