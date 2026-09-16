import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPredictionMarketPolymarketOrderbooksQueryParams } from "./schema/inputs.ts";

/**
 * GET /prediction-market/polymarket/orderbooks — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Polymarket Orderbook History",
        summary: "Historical orderbook snapshots for a Polymarket token.",
        description: "Historical orderbook snapshots for a Polymarket token. " +
            "Returns raw bid/ask depth levels. Timestamps in " +
            "milliseconds. Data refresh: ~5 minutes.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/prediction-market/polymarket-orderbooks",
        categories: ["prediction-markets"],
    },
    request: {
        method: "GET",
        path: "/prediction-market/polymarket/orderbooks",
    },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zPredictionMarketPolymarketOrderbooksQueryParams
                .extend({
                    limit: zPredictionMarketPolymarketOrderbooksQueryParams
                        .shape.limit.unwrap().default(100),
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
