import { z } from "zod";

/** GET /project/ai-news query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zProjectAiNewsQueryParams = z.object({
    id: z.string().min(1).describe(
        "Surf project UUID. PREFERRED — always use this when " +
            "available from a previous response (e.g. project_id from " +
            "/fund/portfolio or id from /search/project). Takes priority " +
            "over q. Example: 25c6612a-395c-4974-94eb-3b5f9f4b2ed7.",
    ).optional(),
    q: z.string().min(1).describe(
        "Fuzzy entity name search. Only use when 'id' is not " +
            "available. May return unexpected results for ambiguous " +
            "names. Example: ethereum.",
    ).optional(),
    limit: z.number().int().min(1).max(50).describe(
        "Results per page. Example: 20. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
    lang: z.enum(["en", "zh", "ja", "kr"]).describe(
        'Language for AI-generated content. Example: en. Defaults to "en".',
    ).optional(),
}).strict();
