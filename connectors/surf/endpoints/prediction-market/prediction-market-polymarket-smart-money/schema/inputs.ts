import { z } from "zod";

/** GET /prediction-market/polymarket/smart-money query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zPredictionMarketPolymarketSmartMoneyQueryParams = z.object({
    view: z.enum(["positioning", "trades"]).describe(
        "positioning = aggregate smart wallet direction per market; " +
            "trades = individual $10K+ trades with wallet metadata. " +
            'Defaults to "positioning".',
    ).optional(),
    condition_id: z.string().min(1).describe(
        "Filter to a specific market (omit to browse all).",
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
        "Filter by category.",
    ).optional(),
    direction: z.enum(["bullish", "bearish", "neutral"]).describe(
        "Filter by net smart money direction (only for view=positioning).",
    ).optional(),
    whale_tier: z.enum(["whale", "large", "mega"]).describe(
        "Trade size tier filter (only for view=trades).",
    ).optional(),
    from: z.string().min(1).describe(
        "Start time as Unix seconds or date string (only for view=trades).",
    ).optional(),
    to: z.string().min(1).describe(
        "End time as Unix seconds or date string (only for view=trades).",
    ).optional(),
    sort_by: z.enum([
        "smart_wallets_involved",
        "smart_buy_volume_usd",
        "smart_sell_volume_usd",
        "amount_usd",
        "block_time",
    ]).describe(
        'Sort field. Defaults to "smart_wallets_involved".',
    ).optional(),
    order: z.enum(["asc", "desc"]).describe(
        'Sort direction. Defaults to "desc".',
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Defaults to 0.",
    ).optional(),
}).strict();
