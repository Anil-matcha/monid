import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPredictionMarketKalshiVolumesQueryParams } from "./schema/inputs.ts";

/**
 * GET /prediction-market/kalshi/volumes — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Kalshi Volume History",
        summary: "Daily trading volume time series for a Kalshi market.",
        description: "Daily trading volume time series for a Kalshi market. " +
            "Data refresh: ~30 minutes.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/prediction-market/kalshi-volumes",
        categories: ["prediction-markets"],
    },
    request: { method: "GET", path: "/prediction-market/kalshi/volumes" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zPredictionMarketKalshiVolumesQueryParams.extend({
                time_range: zPredictionMarketKalshiVolumesQueryParams.shape
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
