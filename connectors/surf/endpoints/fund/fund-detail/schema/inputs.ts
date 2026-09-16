import { z } from "zod";

/** GET /fund/detail query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zFundDetailQueryParams = z.object({
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
}).strict();
