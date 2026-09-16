import { z } from "zod";

/** GET /prediction-market/analytics query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zPredictionMarketAnalyticsQueryParams = z.object({
    category: z.enum([
        "crypto",
        "culture",
        "economics",
        "financials",
        "politics",
        "stem",
        "sports",
    ]).describe(
        "Category to analyze. Omit to get platform-wide totals " +
            "across all categories.",
    ).optional(),
    platform: z.enum(["polymarket", "kalshi"]).describe(
        "Filter to one platform.",
    ).optional(),
    time_range: z.enum(["7d", "30d", "90d", "180d", "1y"]).describe(
        "Window for category trends: 7d, 30d, 90d, 180d, or 1y. " +
            "Bucket size is fixed at 1 day — this endpoint uses " +
            "time_range only and does NOT accept interval. Defaults to " +
            '"30d".',
    ).optional(),
    top_n: z.number().int().min(1).max(50).describe(
        "Number of top markets to include. Defaults to 10.",
    ).optional(),
    sort_by: z.enum([
        "volume_7d",
        "whale_flow_net_7d",
        "price_change_7d",
        "oi_change_7d",
    ]).describe(
        'Sort field for momentum markets. Defaults to "volume_7d".',
    ).optional(),
    order: z.enum(["asc", "desc"]).describe(
        'Sort direction. Defaults to "desc".',
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Limit for momentum markets list. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset for momentum markets. Defaults to 0.",
    ).optional(),
}).strict();
