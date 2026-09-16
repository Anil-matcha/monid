import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zMarketRankingQueryParams } from "./schema/inputs.ts";

/**
 * GET /market/ranking — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Token Rankings",
        summary: "Returns a token leaderboard sorted by market cap, 24h " +
            "change, or volume.",
        description: "Returns a token leaderboard sorted by market cap, 24h " +
            "change, or volume. Each entry includes price, market " +
            "cap, FDV, supply, ATH/ATL, and 24h range. Supports " +
            "category filtering (MEME, AI, L1, L2, DEFI, GAMING, " +
            "etc.). Available sort_by values: market_cap, " +
            "change_24h, volume_24h. Note: change_24h ranks by 24h " +
            "price change within the top 250 coins by market cap; " +
            "Surf's own document calls that top_gainers / " +
            "top_losers, but sort_by does not accept those values. " +
            "For circulating supply, FDV, ATH/ATL, use " +
            "/project/detail?fields=token_info.",
        docsUrl: "https://docs.asksurf.ai/data-api/market/ranking",
        categories: ["token-prices"],
    },
    request: { method: "GET", path: "/market/ranking" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zMarketRankingQueryParams.extend({
                sort_by: zMarketRankingQueryParams.shape.sort_by.unwrap()
                    .default("market_cap"),
                order: zMarketRankingQueryParams.shape.order.unwrap().default(
                    "desc",
                ),
                limit: zMarketRankingQueryParams.shape.limit.unwrap().default(
                    20,
                ),
                offset: zMarketRankingQueryParams.shape.offset.unwrap().default(
                    0,
                ),
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
