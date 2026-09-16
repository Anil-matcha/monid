import { z } from "zod";

/** GET /prediction-market/correlations query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zPredictionMarketCorrelationsQueryParams = z.object({
    category: z.enum([
        "crypto",
        "culture",
        "economics",
        "financials",
        "politics",
        "stem",
        "sports",
    ]).describe(
        "Category (correlations are within-category only).",
    ),
    condition_id: z.string().min(1).describe(
        "Filter to pairs involving this market.",
    ).optional(),
    min_correlation: z.number().describe(
        "Minimum absolute correlation. Defaults to 0.5.",
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Defaults to 0.",
    ).optional(),
}).strict();
