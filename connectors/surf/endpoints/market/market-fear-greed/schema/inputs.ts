import { z } from "zod";

/** GET /market/fear-greed query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zMarketFearGreedQueryParams = z.object({
    from: z.string().min(1).describe(
        "Start of time range. Accepts Unix seconds or date string " +
            "(YYYY-MM-DD). Example: 2026-01-01.",
    ).optional(),
    to: z.string().min(1).describe(
        "End of time range. Accepts Unix seconds or date string " +
            "(YYYY-MM-DD). Example: 2026-03-01.",
    ).optional(),
}).strict();
