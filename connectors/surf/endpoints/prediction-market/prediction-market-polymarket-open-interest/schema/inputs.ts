import { z } from "zod";

/** GET /prediction-market/polymarket/open-interest query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zPredictionMarketPolymarketOpenInterestQueryParams = z.object({
    condition_id: z.string().min(1).describe(
        "Market condition identifier. Example: " +
            "0x6fefc0438c7598b23531457c8c60541990d0786bd4bd9dfc3eabc8d95c291092.",
    ),
    time_range: z.enum(["7d", "30d", "90d", "180d", "1y"]).describe(
        "Window of history to return: 7d, 30d, 90d, 180d, or 1y. " +
            "This endpoint uses time_range only — it does NOT accept " +
            'interval. Example: 30d. Defaults to "30d".',
    ).optional(),
}).strict();
