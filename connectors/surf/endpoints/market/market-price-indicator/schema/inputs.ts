import { z } from "zod";

/** GET /market/price-indicator query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zMarketPriceIndicatorQueryParams = z.object({
    indicator: z.enum([
        "rsi",
        "macd",
        "ema",
        "sma",
        "bbands",
        "stoch",
        "adx",
        "atr",
        "cci",
        "obv",
        "vwap",
        "dmi",
        "ichimoku",
        "supertrend",
    ]).describe(
        "Technical indicator name. Can be rsi, macd, ema, sma, " +
            "bbands, stoch, adx, atr, cci, obv, vwap, dmi, ichimoku, or " +
            "supertrend. Example: rsi.",
    ),
    symbol: z.string().min(1).describe(
        "Trading pair as BTC/USDT or bare symbol like BTC. Example: BTC.",
    ),
    interval: z.enum([
        "1m",
        "5m",
        "15m",
        "30m",
        "1h",
        "2h",
        "4h",
        "12h",
        "1d",
        "1w",
    ]).describe(
        "Candlestick interval — bucket size for each point in the " +
            "indicator series: 1m, 5m, 15m, 30m, 1h, 2h, 4h, 12h, 1d, or " +
            "1w. This endpoint uses interval only; it does NOT accept " +
            "time_range. Use from/to to bound the series. Example: 1d. " +
            'Defaults to "1d".',
    ).optional(),
    exchange: z.enum(["binance", "bybit", "coinbase", "kraken"]).describe(
        "Exchange for price data. Can be binance, bybit, coinbase, " +
            'or kraken. Example: binance. Defaults to "binance".',
    ).optional(),
    from: z.string().min(1).describe(
        "Start of time range. When set, returns time-series instead " +
            "of latest value. Accepts Unix seconds (1704067200) or date " +
            "string (2024-01-01). Example: 2024-01-01.",
    ).optional(),
    to: z.string().min(1).describe(
        "End of time range. Defaults to now when from is set. " +
            "Accepts Unix seconds (1706745600) or date string " +
            "(2024-02-01). Example: 2024-02-01.",
    ).optional(),
    options: z.string().min(1).describe(
        "Indicator-specific options as comma-separated key:value " +
            "pairs. Available options by indicator: period — lookback " +
            "period for rsi (default 14), sma (default 20), ema (default " +
            "20), bbands (default 20), adx (default 14), atr (default " +
            "14), cci (default 20), dmi (default 14), stoch (default " +
            "14), supertrend (default 10). stddev — standard deviation " +
            "for bbands (default 2). multiplier — multiplier for " +
            "supertrend (default 3). fast_period — MACD fast EMA " +
            "(default 12). slow_period — MACD slow EMA (default 26). " +
            "signal_period — MACD signal smoothing (default 9). " +
            "Examples: period:7, period:200, " +
            "fast_period:8,slow_period:21,signal_period:5, " +
            "period:10,stddev:1.5. Example: period:7.",
    ).optional(),
}).strict();
