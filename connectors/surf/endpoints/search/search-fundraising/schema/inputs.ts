import { z } from "zod";

/** GET /search/fundraising query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zSearchFundraisingQueryParams = z.object({
    q: z.string().min(2).max(100).describe(
        "Optional project name, alias, symbol, title, or summary " +
            "search query. When provided, the trimmed query must contain " +
            "2-100 Unicode characters. Example: elliptic.",
    ).optional(),
    from: z.string().min(1).describe(
        "Inclusive event-time lower bound. Accepts Unix seconds, " +
            "YYYY-MM-DD, or RFC3339; date-only values start at 00:00:00 " +
            "UTC. Example: 2026-07-01.",
    ).optional(),
    to: z.string().min(1).describe(
        "Inclusive event-time upper bound. Accepts Unix seconds, " +
            "YYYY-MM-DD, or RFC3339; date-only values end at 23:59:59 " +
            "UTC. Defaults to the current time. Example: 2026-07-10.",
    ).optional(),
    source: z.enum(["social", "news"]).describe(
        "Filter by public source type: social or news. Example: social.",
    ).optional(),
    lang: z.enum(["en", "zh", "ja", "kr", "ko"]).describe(
        "Display and search language. Missing translated fields fall " +
            'back to English. Example: en. Defaults to "en". ko is ' +
            "accepted as an alias for kr.",
    ).optional(),
    min_importance: z.number().int().min(1).max(5).describe(
        "Minimum importance score from 1 to 5. Omit to include " +
            "unscored events. Example: 3.",
    ).optional(),
    sort_by: z.enum(["recency", "relevance", "importance"]).describe(
        "Sort by recency, query relevance, or importance. Relevance " +
            'requires q. Example: recency. Defaults to "recency".',
    ).optional(),
    order: z.enum(["asc", "desc"]).describe(
        "Sort order. Relevance only supports desc. Example: desc. " +
            'Defaults to "desc".',
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Example: 20. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. The offset plus limit cannot exceed " +
            "10000. Example: 0. Defaults to 0.",
    ).optional(),
}).strict();
