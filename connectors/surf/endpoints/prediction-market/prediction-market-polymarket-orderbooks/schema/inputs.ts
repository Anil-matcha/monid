import { z } from "zod";

/** GET /prediction-market/polymarket/orderbooks query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zPredictionMarketPolymarketOrderbooksQueryParams = z.object({
    token_id: z.string().min(1).describe(
        "Token identifier. Example: " +
            "73662070458561467734997715458900555626841827840002814944742182699282770895284.",
    ),
    start_time: z.number().int().describe(
        "Start time in Unix milliseconds. 0 means 7 days ago.",
    ).optional(),
    end_time: z.number().int().describe(
        "End time in Unix milliseconds. 0 means current time.",
    ).optional(),
    limit: z.number().int().min(1).max(200).describe(
        "Maximum number of snapshots to return. Defaults to 100.",
    ).optional(),
    pagination_key: z.string().min(1).describe(
        "Base64 cursor for pagination.",
    ).optional(),
}).strict();
