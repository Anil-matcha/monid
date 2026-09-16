import { z } from "zod";
import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPredictionMarketPolymarketTradesQueryParams } from "./schema/inputs.ts";

/**
 * GET /prediction-market/polymarket/trades — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Polymarket Trades",
        summary:
            "Trade and activity history for a Polymarket market or wallet.",
        description: "Trade and activity history for a Polymarket market or " +
            "wallet. Filter by market (condition_id), wallet " +
            "(address), outcome (Yes/No), minimum trade size, and " +
            "time range. Use type=redemption for " +
            "splits/merges/redemptions, type=all for everything. " +
            "Data refresh: ~5 minutes.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/prediction-market/polymarket-trades",
        categories: ["prediction-markets"],
        notes: [
            "Pass at least one of `condition_id` or `address`; " +
            "`condition_id` takes priority when several are given. A " +
            "request with none is rejected before the wire.",
        ],
    },
    request: { method: "GET", path: "/prediction-market/polymarket/trades" },
    input: {
        schema: {
            // the identifier alternatives compile to anyOf (D4); a union arm
            // takes no binding default (ajv never applies defaults inside anyOf)
            queryParams: z.union([
                zPredictionMarketPolymarketTradesQueryParams.required({
                    condition_id: true,
                }),
                zPredictionMarketPolymarketTradesQueryParams.required({
                    address: true,
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
