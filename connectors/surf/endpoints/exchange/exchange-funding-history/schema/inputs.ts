import { z } from "zod";

/** GET /exchange/funding-history query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zExchangeFundingHistoryQueryParams = z.object({
    pair: z.string().min(1).describe(
        "Trading pair (e.g. BTC/USDT). Example: BTC/USDT.",
    ),
    from: z.string().min(1).describe(
        "Start of time range. Accepts Unix seconds or date string " +
            "(YYYY-MM-DD, ISO8601). Not all exchanges support historical " +
            "queries; some only return recent data regardless of this " +
            "value. Example: 2026-03-01.",
    ).optional(),
    limit: z.number().int().min(1).max(500).describe(
        "Max number of records. For longer history, paginate using " +
            "the last returned timestamp as the next from value. " +
            "Example: 100. Defaults to 100.",
    ).optional(),
    exchange: z.enum([
        "binance",
        "okx",
        "bybit",
        "bitget",
        "gate",
        "htx",
        "mexc",
        "bitfinex",
        "bitmex",
        "hyperliquid",
    ]).describe(
        "Exchange identifier. Note: hyperliquid uses USDC-settled " +
            "perps (e.g. BTC/USDC:USDC); pass USDC-quoted pairs when " +
            "querying hyperliquid. Example: binance. Defaults to " +
            '"binance".',
    ).optional(),
}).strict();
