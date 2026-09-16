import { z } from "zod";

/** GET /prediction-market/polymarket/prices query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zPredictionMarketPolymarketPricesQueryParams = z.object({
    condition_id: z.string().min(1).describe(
        "Market condition identifier. Example: " +
            "0x6fefc0438c7598b23531457c8c60541990d0786bd4bd9dfc3eabc8d95c291092.",
    ),
    time_range: z.enum(["7d", "30d", "90d", "180d", "1y"]).describe(
        "Window of history to return (how much data, from now " +
            "backward): 7d, 30d, 90d, 180d, or 1y. Ignored when " +
            "interval=latest. Distinct from interval (which sets bucket " +
            'size within this window). Example: 30d. Defaults to "30d".',
    ).optional(),
    interval: z.enum(["1h", "1d", "latest"]).describe(
        "Bucket size for each point in the returned series: 1h " +
            "(hourly), 1d (daily), or latest (single most-recent " +
            "snapshot). Distinct from time_range (which sets the window " +
            'size). Example: 1d. Defaults to "1d".',
    ).optional(),
}).strict();
