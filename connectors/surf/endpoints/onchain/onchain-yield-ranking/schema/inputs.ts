import { z } from "zod";

/** GET /onchain/yield/ranking query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zOnchainYieldRankingQueryParams = z.object({
    project: z.string().min(1).describe(
        "Filter by protocol name like lido, aave, or uniswap. Example: aave.",
    ).optional(),
    sort_by: z.enum(["apy", "tvl_usd"]).describe(
        "Ranking metric: apy or tvl_usd. When sorted by apy, only " +
            "pools with TVL >= $100k are included. Example: apy. " +
            'Defaults to "apy".',
    ).optional(),
    order: z.enum(["asc", "desc"]).describe(
        'Sort direction. Example: desc. Defaults to "desc".',
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Example: 20. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
}).strict();
