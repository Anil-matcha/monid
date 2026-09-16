import { z } from "zod";

/** GET /hyperliquid/trades/aggregate query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zHyperliquidTradesAggregateQueryParams = z.object({
    address: z.string().min(1).describe(
        "Wallet address: a 0x EVM address or an ENS name (e.g. " +
            "vitalik.eth). Solana addresses are not supported.",
    ),
    group_by: z.enum([
        "day",
        "symbol",
        "direction",
        "size_bucket",
        "hold_bucket",
    ]).describe(
        "Dimension to roll up by. day = UTC calendar day (the P&L " +
            "calendar / equity-curve source); symbol = per market; " +
            "direction = long vs short; size_bucket = notional-USD " +
            'tiers; hold_bucket = holding-time tiers. Defaults to "day".',
    ).optional(),
    from: z.string().min(1).describe(
        "Window start, bounds close_time: Unix seconds, an ISO " +
            "datetime (2026-03-01T12:00:00Z), or a bare date (= midnight " +
            "UTC). Omit for full history. Example: 2026-03-01.",
    ).optional(),
    to: z.string().min(1).describe(
        "Window end, inclusive, bounds close_time: Unix seconds, an " +
            "ISO datetime, or a bare date — a bare date means the END of " +
            "that UTC day, so from=X&to=X covers the whole day X. " +
            "Defaults to now. Example: 2026-03-31.",
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
        "Market scope: main_dex for the native market only, omit to " +
            "aggregate across ALL markets, or a builder market — one of: " +
            "xyz, flx, vntl, hyna, km, abcd, cash, para, mkts. NOTE: the " +
            "omit default differs from /leaderboard, where omitting dex " +
            "means the native market only.",
    ).optional(),
    fill_gaps: z.boolean().describe(
        "group_by=day only: emit a zero row for every no-trade UTC " +
            "day in the window so the calendar is dense. Requires from " +
            "(a bounded window); ignored for other group_by values. " +
            "Defaults to false.",
    ).optional(),
}).strict();
