import { z } from "zod";

/** GET /exchange/price query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zExchangePriceQueryParams = z.object({
    pair: z.string().min(1).describe(
        "Trading pair (e.g. BTC/USDT). Example: BTC/USDT.",
    ),
    type: z.enum(["spot", "swap", "perpetual", "perp"]).describe(
        "Market type: spot for spot trading, swap/perpetual/perp for " +
            'perpetual contracts. Example: spot. Defaults to "spot".',
    ).optional(),
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
        "Exchange identifier. Note: hyperliquid uses USDC-settled " +
            "perps (e.g. BTC/USDC:USDC); pass USDC-quoted pairs when " +
            "querying hyperliquid. Example: binance. Defaults to " +
            '"binance".',
    ).optional(),
}).strict();
