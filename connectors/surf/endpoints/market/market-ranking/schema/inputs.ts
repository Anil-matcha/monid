import { z } from "zod";

/** GET /market/ranking query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zMarketRankingQueryParams = z.object({
    sort_by: z.enum(["market_cap", "change_24h", "volume_24h"]).describe(
        "Field to sort by. market_cap sorts by total market " +
            "capitalisation, change_24h sorts by 24-hour price change " +
            "percentage (fetches top 250 by market cap then sorts " +
            "client-side), volume_24h sorts by 24-hour trading volume. " +
            'Example: market_cap. Defaults to "market_cap".',
    ).optional(),
    order: z.enum(["asc", "desc"]).describe(
        "Sort order: desc (default, highest first) or asc (lowest " +
            'first). Example: desc. Defaults to "desc".',
    ).optional(),
    category: z.enum([
        "MEME",
        "AI",
        "AI_AGENTS",
        "L1",
        "L2",
        "DEFI",
        "GAMING",
        "STABLECOIN",
        "RWA",
        "DEPIN",
        "SOL_ECO",
        "BASE_ECO",
        "LST",
    ]).describe(
        "Optional token category filter. When provided, results are " +
            "limited to coins in that category. Supported values: MEME, " +
            "AI, AI_AGENTS, L1, L2, DEFI, GAMING, STABLECOIN, RWA, " +
            "DEPIN, SOL_ECO, BASE_ECO, LST. Example: MEME.",
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Example: 20. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
}).strict();
