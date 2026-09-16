import { z } from "zod";

/** GET /exchange/klines query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zExchangeKlinesQueryParams = z.object({
    pair: z.string().min(1).describe(
        "Trading pair (e.g. BTC/USDT). Example: BTC/USDT.",
    ),
    type: z.enum(["spot", "swap", "perpetual", "perp"]).describe(
        "Market type: spot for spot trading, swap/perpetual/perp for " +
            'perpetual contracts. Example: spot. Defaults to "spot".',
    ).optional(),
    interval: z.enum([
        "1m",
        "3m",
        "5m",
        "15m",
        "30m",
        "1h",
        "2h",
        "4h",
        "6h",
        "8h",
        "12h",
        "1d",
        "3d",
        "1w",
        "1M",
    ]).describe(
        "Candle size — bucket duration for each returned OHLCV row. " +
            "This endpoint uses interval only; it does NOT accept " +
            "time_range. Use from + limit to control the window. " +
            'Example: 1h. Defaults to "1h".',
    ).optional(),
    from: z.string().min(1).describe(
        "Start of time range. Accepts Unix seconds or date string " +
            "(YYYY-MM-DD, ISO8601). Example: 2026-03-01.",
    ).optional(),
    limit: z.number().int().min(1).max(1000).describe(
        "Max number of candles to return. Exchange may cap lower " +
            "(e.g. 200-1000). For longer ranges, paginate using the last " +
            "returned timestamp as the next from value. Example: 100. " +
            "Defaults to 100.",
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
