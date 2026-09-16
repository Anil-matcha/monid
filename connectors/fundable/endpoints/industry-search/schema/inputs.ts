import { z } from "zod";

/** GET /industry/search query params. Upstream also accepts an
 *  `industry_type` alias for `type`; only `type` is exposed (both at once
 *  is a 400). */
export const zIndustrySearchQueryParams = z.object({
    name: z.string().min(1).describe(
        "Industry or super-category name; fuzzy matched.",
    ),
    type: z.enum(["INDUSTRY", "SUPER_CATEGORY"]).optional().describe(
        "Restrict to industries or to super categories.",
    ),
}).strict();
