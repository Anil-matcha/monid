import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPredictionMarketPolymarketEventsQueryParams } from "./schema/inputs.ts";

/**
 * GET /prediction-market/polymarket/events — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Polymarket Events",
        summary: "Returns Polymarket events with nested markets, filtered " +
            "by event_slug, which is REQUIRED.",
        description:
            "Returns Polymarket events with nested markets, filtered " +
            "by event_slug, which is REQUIRED. Each event includes " +
            "aggregated status, volume, and a list of markets with " +
            "side_a/side_b outcomes. Data refresh: ~30 minutes.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/prediction-market/polymarket-events",
        categories: ["prediction-markets"],
    },
    request: { method: "GET", path: "/prediction-market/polymarket/events" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zPredictionMarketPolymarketEventsQueryParams.extend({
                limit: zPredictionMarketPolymarketEventsQueryParams.shape.limit
                    .unwrap().default(20),
                offset: zPredictionMarketPolymarketEventsQueryParams.shape
                    .offset.unwrap().default(0),
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
