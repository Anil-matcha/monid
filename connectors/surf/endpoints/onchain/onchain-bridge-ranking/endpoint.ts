import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zOnchainBridgeRankingQueryParams } from "./schema/inputs.ts";

/**
 * GET /onchain/bridge/ranking — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Bridge Protocol Ranking",
        summary:
            "List bridge protocols ranked by USD volume over a time range.",
        description: "List bridge protocols ranked by USD volume over a time " +
            "range. Example: use this when you need bridge " +
            "leaderboard data instead of raw SQL.",
        docsUrl: "https://docs.asksurf.ai/data-api/onchain/bridge-ranking",
        categories: ["defi"],
    },
    request: { method: "GET", path: "/onchain/bridge/ranking" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zOnchainBridgeRankingQueryParams.extend({
                time_range: zOnchainBridgeRankingQueryParams.shape.time_range
                    .unwrap().default("30d"),
                limit: zOnchainBridgeRankingQueryParams.shape.limit.unwrap()
                    .default(20),
                offset: zOnchainBridgeRankingQueryParams.shape.offset.unwrap()
                    .default(0),
            }),
        },
    },
    usage: {
        // Surf's published Standard tier — v1 makePerCallPrice(surfCredits(2)),
        // the balance-differencing drills of 2026-08 (design D1)
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "call",
            consumes: { credit: "default", amount: 2 },
        },
    },
});
