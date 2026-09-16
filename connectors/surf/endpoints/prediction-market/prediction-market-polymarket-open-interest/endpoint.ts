import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPredictionMarketPolymarketOpenInterestQueryParams } from "./schema/inputs.ts";

/**
 * GET /prediction-market/polymarket/open-interest — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Polymarket Open Interest History",
        summary: "Daily open interest time series showing total value " +
            "locked in a Polymarket market.",
        description: "Daily open interest time series showing total value " +
            "locked in a Polymarket market. Data refresh: ~30 " +
            "minutes.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/prediction-market/polymarket-open-interest",
        categories: ["prediction-markets"],
    },
    request: {
        method: "GET",
        path: "/prediction-market/polymarket/open-interest",
    },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zPredictionMarketPolymarketOpenInterestQueryParams
                .extend({
                    time_range:
                        zPredictionMarketPolymarketOpenInterestQueryParams.shape
                            .time_range.unwrap().default("30d"),
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
