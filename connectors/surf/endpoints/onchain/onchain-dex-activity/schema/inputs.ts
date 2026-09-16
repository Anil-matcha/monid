import { z } from "zod";

/** GET /onchain/dex/activity query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zOnchainDexActivityQueryParams = z.object({
    chain: z.enum(["ethereum", "base", "bsc", "arbitrum", "tron"]).describe(
        "Chain to query. Example: ethereum.",
    ),
    project: z.string().min(1).describe(
        "DEX project name (e.g. uniswap, pancakeswap, aerodrome). " +
            "Exactly one of project / address is required. Example: " +
            "uniswap.",
    ).optional(),
    address: z.string().min(1).describe(
        "A specific router/contract measured as tx_to. Exactly one " +
            "of project / address is required. Example: " +
            "0x1111111254eeb25477b68fb85ed929f73a960582.",
    ).optional(),
    time_range: z.enum(["1d", "7d", "30d", "90d"]).describe(
        "Look-back window (hard 90d cap). Overridden by from/to when " +
            'set. Defaults to "7d".',
    ).optional(),
    from: z.string().min(1).describe(
        "Start of range — Unix seconds or YYYY-MM-DD. With to, the " +
            "range may span at most 90 days. Example: 2025-01-01.",
    ).optional(),
    to: z.string().min(1).describe(
        "End of range — Unix seconds or YYYY-MM-DD. Without from, " +
            "the window is time_range ending at to. Example: 2025-02-01.",
    ).optional(),
    group_by: z.enum(["total", "day"]).describe(
        "total = single aggregate; day = daily series (newest " +
            'first). Defaults to "total".',
    ).optional(),
}).strict();
