import { z } from "zod";

/** GET /market/liquidation/chart query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zMarketLiquidationChartQueryParams = z.object({
    symbol: z.string().min(1).describe(
        "Token ticker symbol like BTC or ETH. Example: BTC.",
    ),
    interval: z.enum([
        "1m",
        "3m",
        "5m",
        "15m",
        "30m",
        "1h",
        "4h",
        "6h",
        "8h",
        "12h",
        "1d",
        "1w",
    ]).describe(
        "Candlestick interval — bucket size for each point in the " +
            "liquidation chart series: 1m, 3m, 5m, 15m, 30m, 1h, 4h, 6h, " +
            "8h, 12h, 1d, or 1w. This endpoint uses interval only; it " +
            "does NOT accept time_range. Use from/to to bound the " +
            'series. Example: 1h. Defaults to "1h".',
    ).optional(),
    exchange: z.enum([
        "Binance",
        "OKX",
        "Bybit",
        "Bitget",
        "Hyperliquid",
        "Gate",
        "HTX",
        "Bitmex",
        "Bitfinex",
        "CoinEx",
        "Aster",
        "Lighter",
    ]).describe(
        "Exchange name. Can be Binance, OKX, Bybit, Bitget, " +
            "Hyperliquid, Gate, HTX, Bitmex, Bitfinex, CoinEx, Aster, or " +
            'Lighter. Example: Binance. Defaults to "Binance".',
    ).optional(),
    limit: z.number().int().min(1).max(4500).describe(
        "Results per page. Example: 500. Defaults to 500.",
    ).optional(),
    from: z.string().min(1).describe(
        "Start of time range. Accepts Unix seconds (1704067200) or " +
            "date string (2024-01-01). Example: 2024-01-01.",
    ).optional(),
    to: z.string().min(1).describe(
        "End of time range. Accepts Unix seconds (1706745600) or " +
            "date string (2024-02-01). Example: 2024-02-01.",
    ).optional(),
}).strict();
