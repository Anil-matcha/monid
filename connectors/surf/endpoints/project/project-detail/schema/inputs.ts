import { z } from "zod";

/** GET /project/detail query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zProjectDetailQueryParams = z.object({
    id: z.string().min(1).describe(
        "Surf project UUID. PREFERRED — always use this when " +
            "available from a previous response (e.g. project_id from " +
            "/fund/portfolio or id from /search/project). Takes priority " +
            "over q. Example: 25c6612a-395c-4974-94eb-3b5f9f4b2ed7.",
    ).optional(),
    x_id: z.string().min(1).describe(
        "Numeric X (Twitter) account ID. Resolves to the associated " +
            "project. Example: 984188226826010624.",
    ).optional(),
    handle: z.string().min(1).describe(
        "X (Twitter) handle without @. Resolves to the associated " +
            "project via twitter account lookup. Example: uniswap.",
    ).optional(),
    q: z.string().min(1).describe(
        "Fuzzy entity name search. Only use when 'id' is not " +
            "available. May return unexpected results for ambiguous " +
            "names. Example: ethereum.",
    ).optional(),
    fields: z.string().min(1).describe(
        "Comma-separated sub-resources to include. Can be overview, " +
            "token_info, tokenomics, funding, team, contracts, social, " +
            "or tge_status. Example: overview,token_info,funding. " +
            "Defaults to " +
            '"overview,token_info,tokenomics,funding,team,contracts,social,tge_status".',
    ).optional(),
}).strict();
