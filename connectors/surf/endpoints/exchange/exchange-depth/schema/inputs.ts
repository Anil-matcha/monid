import { z } from "zod";

/** GET /exchange/depth query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zExchangeDepthQueryParams = z.object({
    pair: z.string().min(1).describe(
        "Trading pair (e.g. BTC/USDT). Example: BTC/USDT.",
    ),
    type: z.enum(["spot", "swap", "perpetual", "perp"]).describe(
        "Market type: spot for spot trading, swap/perpetual/perp for " +
            'perpetual contracts. Example: spot. Defaults to "spot".',
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Number of price levels (1-100). Example: 20. Defaults to 20.",
    ).optional(),
    exchange: z.enum([
        "binance",
        "okx",
        "bybit",
        "bitget",
        "coinbase",
        "kraken",
        "gate",
        "mexc",
        "upbit",
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
