import { z } from "zod";

/** GET /prediction-market/polymarket/volume-split/{condition_id} path params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zPredictionMarketPolymarketVolumeSplitPathParams = z.object({
    condition_id: z.string().min(1).describe(
        "Polymarket condition ID. Example: " +
            "0x6fefc0438c7598b23531457c8c60541990d0786bd4bd9dfc3eabc8d95c291092.",
    ),
}).strict();

/** GET /prediction-market/polymarket/volume-split/{condition_id} query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zPredictionMarketPolymarketVolumeSplitQueryParams = z.object({
    granularity: z.enum(["hour", "day", "week"]).describe(
        'Time granularity for volume aggregation. Defaults to "hour".',
    ).optional(),
    start_time: z.number().int().min(0).describe(
        "Start time (Unix seconds). 0 means no lower bound. Cache " +
            "aligns to 5-minute buckets, so two requests within the same " +
            "bucket return the same cached result.",
    ).optional(),
    end_time: z.number().int().min(0).describe(
        "End time (Unix seconds). 0 means current time. Cache aligns " +
            "to 5-minute buckets, so two requests within the same bucket " +
            "return the same cached result.",
    ).optional(),
}).strict();
