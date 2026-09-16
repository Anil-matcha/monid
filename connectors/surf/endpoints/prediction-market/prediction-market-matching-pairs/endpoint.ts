import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPredictionMarketMatchingPairsQueryParams } from "./schema/inputs.ts";

/**
 * GET /prediction-market/matching/pairs — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName:
            "Cross-Platform Prediction Market Matcher (Polymarket <> Kalshi)",
        summary: "Cross-platform prediction market pair matcher — finds " +
            "the same event listed on both Polymarket and Kalshi, " +
            "with live price spread data.",
        description: "Cross-platform prediction market pair matcher — finds " +
            "the same event listed on both Polymarket and Kalshi, " +
            "with live price spread data. This is prediction-market " +
            "only (Polymarket and Kalshi). For crypto exchange " +
            "markets, use exchange-markets. Filter by category, " +
            "match type, confidence score, or look up a specific " +
            "market's cross-platform counterpart via " +
            "polymarket_condition_id or kalshi_market_ticker. Each " +
            "pair includes current prices and spread percentage for " +
            "arbitrage analysis. Sort by spread_pct to find the " +
            "widest spreads. Data refresh: ~5 minutes.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/prediction-market/matching-pairs",
        categories: ["prediction-markets"],
    },
    request: { method: "GET", path: "/prediction-market/matching/pairs" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zPredictionMarketMatchingPairsQueryParams.extend({
                active_only: zPredictionMarketMatchingPairsQueryParams.shape
                    .active_only.unwrap().default(false),
                min_confidence: zPredictionMarketMatchingPairsQueryParams.shape
                    .min_confidence.unwrap().default(0),
                sort_by: zPredictionMarketMatchingPairsQueryParams.shape.sort_by
                    .unwrap().default("confidence"),
                order: zPredictionMarketMatchingPairsQueryParams.shape.order
                    .unwrap().default("desc"),
                limit: zPredictionMarketMatchingPairsQueryParams.shape.limit
                    .unwrap().default(20),
                offset: zPredictionMarketMatchingPairsQueryParams.shape.offset
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
