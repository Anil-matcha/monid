import { z } from "zod";

/** GET /exchange/markets query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zExchangeMarketsQueryParams = z.object({
    exchange: z.enum([
        "binance",
        "okx",
        "bybit",
        "bitget",
        "coinbase",
        "kraken",
        "gate",
        "htx",
        "kucoin",
        "mexc",
        "upbit",
        "bitfinex",
        "bitstamp",
        "deribit",
        "bitmex",
        "bithumb",
        "hyperliquid",
    ]).describe(
        "Exchange identifier. Defaults to binance. Pass a specific " +
            "venue to list that exchange only.",
    ).optional(),
    type: z.enum(["spot", "swap", "future", "option", "perpetual", "perp"])
        .describe(
            "Market type filter. Use perpetual or perp for perpetual " +
                "contracts (alias for swap). Example: spot.",
        ).optional(),
    base: z.string().min(1).describe(
        "Filter by base currency. Example: ETH.",
    ).optional(),
    quote: z.string().min(1).describe(
        "Filter by quote currency. Example: USDT.",
    ).optional(),
    search: z.string().min(1).describe(
        "Fuzzy search in pair/base/quote. Example: ETH.",
    ).optional(),
    limit: z.number().int().min(1).max(5000).describe(
        "Max results. Example: 100. Defaults to 100.",
    ).optional(),
}).strict();
