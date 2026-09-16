import { z } from "zod";
import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPredictionMarketPolymarketVolumesQueryParams } from "./schema/inputs.ts";

/**
 * GET /prediction-market/polymarket/volumes — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Polymarket Volume History",
        summary:
            "Aggregate trading volume (USD) and trade count as a time series.",
        description: "Aggregate trading volume (USD) and trade count as a " +
            "time series. Use this for volume trend analysis. For " +
            "YES/NO volume breakdown by outcome side, use " +
            "volume-split instead. Data refresh: ~30 minutes.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/prediction-market/polymarket-volumes",
        categories: ["prediction-markets"],
        notes: [
            "Pass at least one of `condition_id` or `token_id`; " +
            "`condition_id` takes priority when several are given. A " +
            "request with none is rejected before the wire.",
        ],
    },
    request: { method: "GET", path: "/prediction-market/polymarket/volumes" },
    input: {
        schema: {
            // the identifier alternatives compile to anyOf (D4); a union arm
            // takes no binding default (ajv never applies defaults inside anyOf)
            queryParams: z.union([
                zPredictionMarketPolymarketVolumesQueryParams.required({
                    condition_id: true,
                }),
                zPredictionMarketPolymarketVolumesQueryParams.required({
                    token_id: true,
                }),
            ]),
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
