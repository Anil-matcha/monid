import { z } from "zod";

/** GET /wallet/net-worth query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zWalletNetWorthQueryParams = z.object({
    address: z.string().min(1).describe(
        "Wallet address — must be a raw 0x-prefixed hex address (EVM " +
            "only). Solana and ENS names are not supported. Example: " +
            "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045.",
    ),
}).strict();
