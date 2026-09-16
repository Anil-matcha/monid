import { z } from "zod";

/** GET /news/detail query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zNewsDetailQueryParams = z.object({
    id: z.string().min(1).describe(
        "Article ID (returned as id in feed/search results). " +
            "Example: e54e0ac4-1ef8-44d2-928e-52df465e2c81.",
    ),
}).strict();
