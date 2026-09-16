import { z } from "zod";

/** GET /market/futures query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zMarketFuturesQueryParams = z.object({
    sort_by: z.enum([
        "open_interest",
        "funding_rate",
        "volume_24h",
        "long_short_ratio",
    ]).describe(
        "Field to sort results by. Example: volume_24h. Defaults to " +
            '"volume_24h".',
    ).optional(),
    order: z.enum(["asc", "desc"]).describe(
        'Sort order. Example: desc. Defaults to "desc".',
    ).optional(),
}).strict();
