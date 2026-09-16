import { z } from "zod";

/** GET /heatscore/token-of-week query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zHeatscoreTokenOfWeekQueryParams = z.object({
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Example: 20. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
}).strict();
