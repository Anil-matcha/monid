import { z } from "zod";

/** GET /exchange/long-short-ratio query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zExchangeLongShortRatioQueryParams = z.object({
    pair: z.string().min(1).describe(
        "Trading pair (e.g. BTC/USDT). Example: BTC/USDT.",
    ),
    interval: z.enum(["1h", "4h", "1d"]).describe(
        "Bucket size for each point in the series: 1h, 4h, or 1d. " +
            "This endpoint uses interval only; it does NOT accept " +
            "time_range. Use from + limit to control the window. " +
            'Example: 1h. Defaults to "1h".',
    ).optional(),
    from: z.string().min(1).describe(
        "Start of time range. Accepts Unix seconds or date string " +
            "(YYYY-MM-DD, ISO8601). Binance only retains the last 30 " +
            "days of data; other exchanges may have different limits. " +
            "Example: 2026-03-01.",
    ).optional(),
    limit: z.number().int().min(1).max(500).describe(
        "Max number of records. For longer history, paginate using " +
            "the last returned timestamp as the next from value. " +
            "Example: 50. Defaults to 50.",
    ).optional(),
    exchange: z.enum(["binance", "okx", "bybit", "bitget"]).describe(
        'Exchange identifier. Example: binance. Defaults to "binance".',
    ).optional(),
}).strict();
