import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPredictionMarketCorrelationsQueryParams } from "./schema/inputs.ts";

/**
 * GET /prediction-market/correlations — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Market Correlations",
        summary: "Returns 30-day Pearson price correlation pairs between " +
            "Polymarket markets within a category.",
        description: "Returns 30-day Pearson price correlation pairs between " +
            "Polymarket markets within a category. Correlation data " +
            "covers the top 100 markets by 7-day volume globally; " +
            "lower-volume markets may not have correlation data. " +
            "Filter by condition_id to find all markets correlated " +
            "with a specific market, or set min_correlation to " +
            "control the threshold. The category parameter is " +
            "required. Data refresh: ~5 minutes.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/prediction-market/correlations",
        categories: ["prediction-markets"],
    },
    request: { method: "GET", path: "/prediction-market/correlations" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zPredictionMarketCorrelationsQueryParams.extend({
                min_correlation: zPredictionMarketCorrelationsQueryParams.shape
                    .min_correlation.unwrap().default(0.5),
                limit: zPredictionMarketCorrelationsQueryParams.shape.limit
                    .unwrap().default(20),
                offset: zPredictionMarketCorrelationsQueryParams.shape.offset
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
