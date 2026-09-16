import { z } from "zod";

/** GET /heatscore/projects query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zHeatscoreProjectsQueryParams = z.object({
    time_range: z.enum(["24h", "7d"]).describe(
        "Window to compute signal scores over: 24h or 7d. Returns a " +
            "ranked snapshot, not a time-series. Example: 24h. Defaults " +
            'to "24h".',
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Example: 20. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
}).strict();
