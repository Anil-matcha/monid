import { z } from "zod";

/** GET /onchain/bridge/ranking query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zOnchainBridgeRankingQueryParams = z.object({
    time_range: z.enum(["7d", "30d", "90d", "180d", "1y", "all"]).describe(
        "Window to aggregate bridge volume over: 7d, 30d, 90d, 180d, " +
            "1y, or all. Returns a single ranked snapshot (not a " +
            "time-series). This endpoint uses time_range only — it does " +
            'NOT accept interval. Example: 30d. Defaults to "30d".',
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Example: 20. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
}).strict();
