import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zProjectDefiRankingQueryParams } from "./schema/inputs.ts";

/**
 * GET /project/defi/ranking — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "DeFi Protocol Ranking",
        summary: "Returns a DeFi protocol leaderboard (e.g. Aave, " +
            "Uniswap, Lido) ranked by TVL, fees, revenue, or users.",
        description: "Returns a DeFi protocol leaderboard (e.g. Aave, " +
            "Uniswap, Lido) ranked by TVL, fees, revenue, or users. " +
            "For individual pool/vault yields, use " +
            "onchain-yield-ranking instead. Available metrics: tvl, " +
            "revenue, fees, volume, users.",
        docsUrl: "https://docs.asksurf.ai/data-api/project/defi-ranking",
        categories: ["defi"],
    },
    request: { method: "GET", path: "/project/defi/ranking" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zProjectDefiRankingQueryParams.extend({
                limit: zProjectDefiRankingQueryParams.shape.limit.unwrap()
                    .default(20),
                offset: zProjectDefiRankingQueryParams.shape.offset.unwrap()
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
