import { z } from "zod";

/** GET /market/tge query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zMarketTgeQueryParams = z.object({
    id: z.string().min(1).describe(
        "Surf project UUID. Example: 25c6612a-395c-4974-94eb-3b5f9f4b2ed7.",
    ).optional(),
    q: z.string().min(1).describe(
        "Project name or symbol for entity resolution. Example: bitcoin.",
    ).optional(),
}).strict();
