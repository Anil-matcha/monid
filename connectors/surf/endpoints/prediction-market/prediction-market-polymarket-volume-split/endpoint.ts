import { defineEndpoint, UsageModelKind } from "@shared/core";
import {
    zPredictionMarketPolymarketVolumeSplitPathParams,
    zPredictionMarketPolymarketVolumeSplitQueryParams,
} from "./schema/inputs.ts";

/**
 * GET /prediction-market/polymarket/volume-split/{condition_id} — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Polymarket Volume Split (YES/NO)",
        summary: "Volume split by YES/NO outcome sides per interval " +
            "(hour/day/week), plus total volume and trade count.",
        description: "Volume split by YES/NO outcome sides per interval " +
            "(hour/day/week), plus total volume and trade count. Use " +
            "this to see directional volume bias. For aggregate " +
            "volume without YES/NO breakdown, use volumes instead. " +
            "Data refresh: ~30 minutes.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/prediction-market/polymarket-volume-split",
        categories: ["prediction-markets"],
    },
    /** PUBLIC identity pinned brace-free (the id regex admits no
     *  placeholders); the wire path keeps `{condition_id}` (design D9). */
    endpoint: "/prediction-market/polymarket/volume-split",
    request: {
        method: "GET",
        path: "/prediction-market/polymarket/volume-split/{condition_id}",
    },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            pathParams: zPredictionMarketPolymarketVolumeSplitPathParams,
            queryParams: zPredictionMarketPolymarketVolumeSplitQueryParams
                .extend({
                    granularity:
                        zPredictionMarketPolymarketVolumeSplitQueryParams.shape
                            .granularity.unwrap().default("hour"),
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
