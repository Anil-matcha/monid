import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPredictionMarketMatchingDailyQueryParams } from "./schema/inputs.ts";

/**
 * GET /prediction-market/matching/daily — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Cross-Platform Daily Comparison (Polymarket <> Kalshi)",
        summary: "Returns daily volume and open interest comparison for a " +
            "specific Polymarket <> Kalshi matched pair.",
        description:
            "Returns daily volume and open interest comparison for a " +
            "specific Polymarket <> Kalshi matched pair. Both " +
            "polymarket_condition_id and kalshi_market_ticker are " +
            "required. Use matching-market-pairs to discover matched " +
            "pairs first. Volume units: Polymarket = USD, Kalshi = " +
            "contracts.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/prediction-market/matching-daily",
        categories: ["prediction-markets"],
    },
    request: { method: "GET", path: "/prediction-market/matching/daily" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zPredictionMarketMatchingDailyQueryParams.extend({
                time_range: zPredictionMarketMatchingDailyQueryParams.shape
                    .time_range.unwrap().default("30d"),
                limit: zPredictionMarketMatchingDailyQueryParams.shape.limit
                    .unwrap().default(200),
                offset: zPredictionMarketMatchingDailyQueryParams.shape.offset
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
