import { z } from "zod";

/** GET /search/prediction-market query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zSearchPredictionMarketQueryParams = z.object({
    condition_id: z.string().min(1).describe(
        "Polymarket condition ID for single-market lookup.",
    ).optional(),
    market_ticker: z.string().min(1).describe(
        "Kalshi market ticker for single-market lookup.",
    ).optional(),
    platform: z.enum(["polymarket", "kalshi"]).describe(
        "Filter by platform (omit for both).",
    ).optional(),
    category: z.enum([
        "crypto",
        "culture",
        "economics",
        "financials",
        "politics",
        "stem",
        "sports",
    ]).describe(
        "Filter by Surf-curated category.",
    ).optional(),
    status: z.enum(["active", "closed", "finalized"]).describe(
        'Market status filter. Defaults to "active".',
    ).optional(),
    sort_by: z.enum([
        "volume_1d",
        "volume_7d",
        "volume_30d",
        "open_interest",
        "trade_count_7d",
        "days_to_resolution",
    ]).describe(
        'Sort field. Defaults to "volume_7d".',
    ).optional(),
    order: z.enum(["asc", "desc"]).describe(
        'Sort direction. Defaults to "desc".',
    ).optional(),
    smart_money: z.enum(["bullish", "bearish"]).describe(
        "Filter by smart money direction (Polymarket only).",
    ).optional(),
    q: z.string().min(2).max(100).describe(
        "Search markets by keyword in question text or ticker. " +
            "Results include slug and event fields when available, but " +
            "machine slugs are not searched.",
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Defaults to 0.",
    ).optional(),
}).strict();
