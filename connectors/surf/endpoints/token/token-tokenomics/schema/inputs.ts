import { z } from "zod";

/** GET /token/tokenomics query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zTokenTokenomicsQueryParams = z.object({
    id: z.string().min(1).describe(
        "Surf project UUID. PREFERRED — always use this when " +
            "available from a previous response. Takes priority over " +
            "symbol. Example: 25c6612a-395c-4974-94eb-3b5f9f4b2ed7.",
    ).optional(),
    symbol: z.string().min(1).describe(
        "Token symbol like ARB, OP, or APT. Example: ARB.",
    ).optional(),
    from: z.string().min(1).describe(
        "Start of time range. Accepts Unix seconds (1704067200) or " +
            "date string (2024-01-01). Example: 2024-01-01.",
    ).optional(),
    to: z.string().min(1).describe(
        "End of time range. Accepts Unix seconds (1735689600) or " +
            "date string (2025-01-01). Example: 2025-01-01.",
    ).optional(),
}).strict();
