import { z } from "zod";

/** GET /search/news query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zSearchNewsQueryParams = z.object({
    q: z.string().min(2).max(100).describe(
        "Search keyword or phrase. Example: bitcoin ETF.",
    ),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Example: 10. Defaults to 10.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
}).strict();
