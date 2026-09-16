import { z } from "zod";

/** GET /heatscore/detail query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zHeatscoreDetailQueryParams = z.object({
    id: z.string().min(1).describe(
        "Surf token UUID. Pass exactly one of id or project_slug. " +
            "Example: 25c6612a-395c-4974-94eb-3b5f9f4b2ed7.",
    ).optional(),
    project_slug: z.string().min(1).describe(
        "Project slug. Pass exactly one of id or project_slug. " +
            "Example: synapse.",
    ).optional(),
    time_range: z.enum(["24h", "7d"]).describe(
        "Window to compute signal score over: 24h or 7d. Example: " +
            '24h. Defaults to "24h".',
    ).optional(),
}).strict();
