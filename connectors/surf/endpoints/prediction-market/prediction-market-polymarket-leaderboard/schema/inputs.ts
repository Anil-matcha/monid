import { z } from "zod";

/** GET /prediction-market/polymarket/leaderboard query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zPredictionMarketPolymarketLeaderboardQueryParams = z.object({
    sort_by: z.enum(["pnl", "volume", "trade_count"]).describe(
        'Ranking metric. Defaults to "pnl".',
    ).optional(),
    order: z.enum(["asc", "desc"]).describe(
        'Sort direction. Defaults to "desc".',
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Defaults to 0.",
    ).optional(),
}).strict();
