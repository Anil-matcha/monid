import { z } from "zod";

/** GET /project/defi/metrics query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zProjectDefiMetricsQueryParams = z.object({
    id: z.string().min(1).describe(
        "Surf project UUID. PREFERRED — always use this when " +
            "available from a previous response (e.g. project_id from " +
            "/fund/portfolio or id from /search/project). Takes priority " +
            "over q. Example: 25c6612a-395c-4974-94eb-3b5f9f4b2ed7.",
    ).optional(),
    q: z.string().min(1).describe(
        "Fuzzy entity name search. Only use when 'id' is not " +
            "available. May return unexpected results for ambiguous " +
            "names. Example: uniswap.",
    ).optional(),
    metric: z.enum(["volume", "fee", "fees", "revenue", "tvl", "users"])
        .describe(
            "Metric to query. Can be volume, fees (or fee alias), " +
                "revenue, tvl, or users. Defaults to tvl. Example: tvl. " +
                'Defaults to "tvl".',
        ).optional(),
    from: z.string().min(1).describe(
        "Start of time range. Accepts Unix seconds (1704067200) or " +
            "date string (2024-01-01). Example: 2024-01-01.",
    ).optional(),
    to: z.string().min(1).describe(
        "End of time range. Accepts Unix seconds (1706745600) or " +
            "date string (2024-02-01). Example: 2024-02-01.",
    ).optional(),
    chain: z.enum([
        "ethereum",
        "polygon",
        "bsc",
        "arbitrum",
        "optimism",
        "base",
        "avalanche",
        "fantom",
        "solana",
    ]).describe(
        "Filter by chain. Can be ethereum, polygon, bsc, arbitrum, " +
            "optimism, base, avalanche, fantom, or solana. Example: " +
            "ethereum.",
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Example: 20. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
}).strict();
