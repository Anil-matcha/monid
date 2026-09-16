import { z } from "zod";

/** GET /exchange/perp query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zExchangePerpQueryParams = z.object({
    pair: z.string().min(1).describe(
        "Trading pair (e.g. BTC/USDT). The swap settle suffix is " +
            "added automatically from the quote currency, e.g. " +
            "BTC/USDT:USDT or BTC/USDC:USDC. Example: BTC/USDT.",
    ),
    fields: z.string().min(1).describe(
        "Comma-separated fields to include: 'funding' (current " +
            "funding rate), 'oi' (open interest). Defaults to all " +
            'fields. Example: funding,oi. Defaults to "funding,oi".',
    ).optional(),
    exchange: z.enum([
        "binance",
        "okx",
        "bybit",
        "bitget",
        "htx",
        "bitfinex",
        "bitmex",
        "hyperliquid",
    ]).describe(
        "Exchange identifier. Hyperliquid uses USDC-settled perps " +
            "(e.g. BTC/USDC:USDC). Example: binance. Defaults to " +
            '"binance".',
    ).optional(),
}).strict();
