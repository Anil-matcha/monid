import { z } from "zod";

/** GET /prediction-market/polymarket/volumes query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zPredictionMarketPolymarketVolumesQueryParams = z.object({
    condition_id: z.string().min(1).describe(
        "Market condition identifier (required if token_id not " +
            "provided). Example: " +
            "0x6fefc0438c7598b23531457c8c60541990d0786bd4bd9dfc3eabc8d95c291092.",
    ).optional(),
    token_id: z.string().min(1).describe(
        "Token ID (alternative identifier, resolved to condition_id " +
            "internally).",
    ).optional(),
    time_range: z.enum(["7d", "30d", "90d", "180d", "1y"]).describe(
        "Window of history to return (how much data, from now " +
            "backward): 7d, 30d, 90d, 180d, or 1y. Distinct from " +
            "interval (which sets bucket size within the window). " +
            'Example: 30d. Defaults to "30d".',
    ).optional(),
    interval: z.enum(["1h", "1d"]).describe(
        "Bucket size for each point in the returned series: 1h " +
            "(hourly) or 1d (daily). Distinct from time_range (which " +
            'sets the window size). Example: 1d. Defaults to "1d".',
    ).optional(),
    granularity: z.enum(["day", "week", "month", "year", "all"]).describe(
        "Aggregation granularity (alternative to interval). When " +
            "provided, queries daily table with buy/sell volume " +
            "breakdown.",
    ).optional(),
    start_time: z.number().int().describe(
        "Start time as Unix seconds (alternative to time_range).",
    ).optional(),
    end_time: z.number().int().describe(
        "End time as Unix seconds (alternative to time_range).",
    ).optional(),
}).strict();
