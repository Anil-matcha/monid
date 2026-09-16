import { z } from "zod";

/** GET /exchange/candles query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zExchangeCandlesQueryParams = z.object({
    exchange: z.enum([
        "bithumb",
        "upbit",
        "hashkey",
        "bitflyer",
        "coinone",
        "korbit",
    ]).describe(
        "Exchange identifier. Example: bithumb.",
    ),
    pair: z.string().min(1).describe(
        "Trading pair in base/quote form, e.g. BTC/KRW. Example: BTC/KRW.",
    ),
    interval: z.enum(["5m", "4h", "1w"]).describe(
        'Candle interval. Example: 5m. Defaults to "5m".',
    ).optional(),
    from: z.string().min(1).describe(
        "Start of time range. Accepts Unix seconds or date string. " +
            "Example: 2026-06-24T09:00:00Z.",
    ).optional(),
    to: z.string().min(1).describe(
        "End of time range. Accepts Unix seconds or date string. " +
            "Example: 2026-06-24T10:00:00Z.",
    ).optional(),
    include_synthetic: z.boolean().describe(
        "Whether to include carry-forward candles for no-trade " +
            "intervals. Defaults to true for continuous charts; set " +
            "false for raw exchange-only candles. Example: True. " +
            "Defaults to true.",
    ).optional(),
    limit: z.number().int().min(1).max(300).describe(
        "Max number of candles to return. Weekly candles allow up to " +
            "300 rows for a 5-year chart; intraday intervals are capped " +
            "at 100. Example: 100. Defaults to 100.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
}).strict();
