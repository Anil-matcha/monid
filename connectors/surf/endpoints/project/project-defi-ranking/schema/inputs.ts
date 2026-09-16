import { z } from "zod";

/** GET /project/defi/ranking query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zProjectDefiRankingQueryParams = z.object({
    metric: z.enum(["tvl", "revenue", "fees", "volume", "users"]).describe(
        "Ranking metric. Can be tvl, revenue, fees, volume, or " +
            "users. Example: tvl.",
    ),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Example: 20. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
}).strict();
