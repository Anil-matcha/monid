import { z } from "zod";

/** GET /wallet/labels/batch query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zWalletLabelsBatchQueryParams = z.object({
    addresses: z.string().min(1).describe(
        "Comma-separated wallet addresses to look up, max 100. " +
            "Example: 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045,0xdead.",
    ),
}).strict();
