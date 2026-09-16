import { z } from "zod";

/** GET /prediction-market/matching/daily query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zPredictionMarketMatchingDailyQueryParams = z.object({
    polymarket_condition_id: z.string().min(1).describe(
        "Polymarket condition ID. Example: " +
            "0x6fefc0438c7598b23531457c8c60541990d0786bd4bd9dfc3eabc8d95c291092.",
    ),
    kalshi_market_ticker: z.string().min(1).describe(
        "Kalshi market ticker. Example: KXBTC2026250-27JAN01-250000.",
    ),
    time_range: z.enum(["1d", "7d", "30d", "90d", "180d", "1y", "all"])
        .describe(
            "Window of daily data to return: 1d, 7d, 30d, 90d, 180d, 1y, " +
                "or all. Bucket size is fixed at 1 day — this endpoint uses " +
                "time_range only and does NOT accept interval. Example: 30d. " +
                'Defaults to "30d".',
        ).optional(),
    limit: z.number().int().min(1).max(10000).describe(
        "Maximum rows. Example: 200. Defaults to 200.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
}).strict();
