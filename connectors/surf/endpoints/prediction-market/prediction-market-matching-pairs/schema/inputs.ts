import { z } from "zod";

/** GET /prediction-market/matching/pairs query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zPredictionMarketMatchingPairsQueryParams = z.object({
    category: z.enum([
        "crypto",
        "culture",
        "economics",
        "financials",
        "politics",
        "stem",
        "sports",
    ]).describe(
        "Filter by category. Example: politics.",
    ).optional(),
    match_type: z.enum(["exact", "related"]).describe(
        "Filter by match type. Example: exact.",
    ).optional(),
    active_only: z.boolean().describe(
        "Only return pairs where both markets are currently active. " +
            "Defaults to false.",
    ).optional(),
    min_confidence: z.number().int().min(0).max(100).describe(
        "Minimum confidence score (0-100). Defaults to 0.",
    ).optional(),
    polymarket_condition_id: z.string().min(1).describe(
        "Find match for this Polymarket market.",
    ).optional(),
    kalshi_market_ticker: z.string().min(1).describe(
        "Find match for this Kalshi market.",
    ).optional(),
    sort_by: z.enum([
        "confidence",
        "polymarket_volume",
        "kalshi_volume",
        "spread_pct",
    ]).describe(
        'Sort field. Defaults to "confidence".',
    ).optional(),
    order: z.enum(["asc", "desc"]).describe(
        'Sort order. Defaults to "desc".',
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Maximum rows to return. Example: 20. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
}).strict();
