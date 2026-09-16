import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPredictionMarketKalshiOrderbooksQueryParams } from "./schema/inputs.ts";

/**
 * GET /prediction-market/kalshi/orderbooks — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Kalshi Orderbook History",
        summary: "Historical orderbook snapshots for a Kalshi market.",
        description: "Historical orderbook snapshots for a Kalshi market. " +
            "Returns yes-side bid/ask levels. Timestamps in " +
            "milliseconds, prices in cents. Data refresh: ~5 " +
            "minutes.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/prediction-market/kalshi-orderbooks",
        categories: ["prediction-markets"],
    },
    request: { method: "GET", path: "/prediction-market/kalshi/orderbooks" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zPredictionMarketKalshiOrderbooksQueryParams.extend({
                limit: zPredictionMarketKalshiOrderbooksQueryParams.shape.limit
                    .unwrap().default(100),
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
