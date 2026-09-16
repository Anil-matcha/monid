import { z } from "zod";

/** GET /news/feed query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zNewsFeedQueryParams = z.object({
    source: z.enum([
        "coindesk",
        "cointelegraph",
        "theblock",
        "decrypt",
        "dlnews",
        "blockbeats",
        "bitcoincom",
        "coinpedia",
        "ambcrypto",
        "cryptodaily",
        "cryptopotato",
        "phemex",
        "panews",
        "odaily",
        "tradingview",
        "chaincatcher",
        "techflow",
    ]).describe(
        "Filter by news source. Example: coindesk.",
    ).optional(),
    project: z.string().min(1).describe(
        "Comma-separated project names to filter by. Example: bitcoin,ethereum.",
    ).optional(),
    from: z.string().min(1).describe(
        "Filter articles published on or after this time. Accepts " +
            "Unix seconds or date string (2024-01-01). Example: " +
            "2024-01-01.",
    ).optional(),
    to: z.string().min(1).describe(
        "Filter articles published on or before this time. Accepts " +
            "Unix seconds or date string (2024-02-01). Example: " +
            "2024-02-01.",
    ).optional(),
    sort_by: z.enum(["recency", "trending"]).describe(
        "Sort order: recency (newest first) or trending " +
            "(deterministic newest-first alias until engagement ranking " +
            'is available). Example: recency. Defaults to "recency".',
    ).optional(),
    limit: z.number().int().min(1).max(50).describe(
        "Results per page (max 50). Example: 20. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
}).strict();
