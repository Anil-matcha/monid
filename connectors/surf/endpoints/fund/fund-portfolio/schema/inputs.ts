import { z } from "zod";

/** GET /fund/portfolio query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zFundPortfolioQueryParams = z.object({
    id: z.string().min(1).describe(
        "Surf fund UUID. PREFERRED — always use this when available " +
            "from a previous response (e.g. id from /search/fund). Takes " +
            "priority over q. Example: " +
            "ef3b6da9-283d-4080-b3c7-87b1b45924dc.",
    ).optional(),
    q: z.string().min(1).describe(
        "Fuzzy fund name search. Only use when 'id' is not " +
            "available. May return unexpected results for ambiguous " +
            "names. Example: a16z.",
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Example: 20. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
    is_lead: z.enum(["true", "false", ""]).describe(
        "Filter by lead investor status. Omit or leave empty for all " +
            "investments. Example: true.",
    ).optional(),
    invested_after: z.number().int().describe(
        "Only include investments at or after this Unix timestamp " +
            "(seconds). Example: 1704067200.",
    ).optional(),
    invested_before: z.number().int().describe(
        "Only include investments before this Unix timestamp " +
            "(seconds). Example: 1735689600.",
    ).optional(),
    sort_by: z.enum(["invested_at", "recent_raise", "total_raise"]).describe(
        "Field to sort results by. Example: recent_raise. Defaults " +
            'to "invested_at".',
    ).optional(),
    order: z.enum(["asc", "desc"]).describe(
        'Sort order. Example: desc. Defaults to "desc".',
    ).optional(),
}).strict();
