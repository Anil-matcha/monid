import { z } from "zod";

/** GET /market/price query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zMarketPriceQueryParams = z.object({
    symbol: z.string().min(1).describe(
        "Single token ticker symbol like BTC, ETH, or SOL " +
            "(multi-symbol not supported). Example: BTC.",
    ),
    time_range: z.enum(["1d", "7d", "14d", "30d", "90d", "180d", "365d", "max"])
        .describe(
            "Window of historical data to return: 1d, 7d, 14d, 30d, 90d, " +
                "180d, 365d, or max. Ignored when from/to are set. This " +
                "endpoint uses time_range only — it does NOT accept " +
                "interval; bucket granularity is chosen server-side based on " +
                'the window size. Example: 30d. Defaults to "30d".',
        ).optional(),
    from: z.string().min(1).describe(
        "Start of custom date range (Unix timestamp or YYYY-MM-DD). " +
            "Must be used together with to. Overrides time_range when " +
            "set. Example: 2025-01-01.",
    ).optional(),
    to: z.string().min(1).describe(
        "End of custom date range (Unix timestamp or YYYY-MM-DD). " +
            "Must be used together with from. Overrides time_range when " +
            "set. Example: 2025-03-01.",
    ).optional(),
    currency: z.string().min(1).describe(
        "Quote currency like usd, eur, or btc. Example: usd. " +
            'Defaults to "usd".',
    ).optional(),
}).strict();
