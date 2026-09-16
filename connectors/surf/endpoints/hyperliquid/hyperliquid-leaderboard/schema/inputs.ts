import { z } from "zod";

/** GET /hyperliquid/leaderboard query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zHyperliquidLeaderboardQueryParams = z.object({
    time_range: z.enum(["1d", "7d", "30d", "90d", "all"]).describe(
        "Window to rank over. Default all (data starts 2025-08-01). " +
            'Defaults to "all".',
    ).optional(),
    sort_by: z.enum(["total_pnl", "win_rate", "volume_traded"]).describe(
        "Rank by this metric. Always sorted descending. Defaults to " +
            '"total_pnl".',
    ).optional(),
    min_trades: z.number().int().min(0).describe(
        "Only traders with at least this many trades. Defaults to 5; " +
            "pass 0 for the full population. Defaults to 5.",
    ).optional(),
    min_days_active: z.number().int().min(0).describe(
        "Only traders active at least this many days (0 = no " +
            "filter). Defaults to 0.",
    ).optional(),
    min_account_age_days: z.number().int().min(0).describe(
        "Only accounts at least this old, in days (0 = no filter). " +
            "Defaults to 0.",
    ).optional(),
    min_human_score: z.number().int().min(0).max(100).describe(
        "Only traders scoring at least this, 0-100 (0 = no filter). " +
            "Defaults to 0.",
    ).optional(),
    dex: z.enum([
        "main_dex",
        "xyz",
        "flx",
        "vntl",
        "hyna",
        "km",
        "abcd",
        "cash",
        "para",
        "mkts",
    ]).describe(
        "Market to rank within: main_dex (or omit) for the native " +
            "market ONLY, or a builder market — one of: xyz, flx, vntl, " +
            "hyna, km, abcd, cash, para, mkts. NOTE: the omit default " +
            "differs from /trades/aggregate, where omitting dex " +
            "aggregates across ALL markets.",
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page (1-100). Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Results to skip. Defaults to 0.",
    ).optional(),
}).strict();
