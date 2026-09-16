import { z } from "zod";

/** GET /market/options query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zMarketOptionsQueryParams = z.object({
    symbol: z.enum(["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "ADA", "AVAX"])
        .describe(
            "Token symbol. Can be BTC, ETH, SOL, XRP, BNB, DOGE, ADA, or " +
                "AVAX. Example: BTC.",
        ),
    sort_by: z.enum(["open_interest", "volume_24h"]).describe(
        "Field to sort results by. Example: volume_24h. Defaults to " +
            '"volume_24h".',
    ).optional(),
    order: z.enum(["asc", "desc"]).describe(
        'Sort order. Example: desc. Defaults to "desc".',
    ).optional(),
}).strict();
