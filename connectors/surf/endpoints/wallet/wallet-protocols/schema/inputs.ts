import { z } from "zod";

/** GET /wallet/protocols query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zWalletProtocolsQueryParams = z.object({
    address: z.string().min(1).describe(
        "Wallet address — must be a raw 0x-prefixed hex address, not " +
            "an ENS name. Example: " +
            "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045.",
    ),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Example: 20. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
}).strict();
