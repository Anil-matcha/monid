import { z } from "zod";

/** GET /wallet/detail query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zWalletDetailQueryParams = z.object({
    address: z.string().min(1).describe(
        "Wallet address (0x hex for EVM, base58 for Solana). " +
            "Example: 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045.",
    ),
    chain: z.enum([
        "ethereum",
        "polygon",
        "bsc",
        "avalanche",
        "arbitrum",
        "optimism",
        "fantom",
        "base",
        "solana",
    ]).describe(
        "Chain filter for tokens, nft, and approvals. When omitted, " +
            "inferred from address format: 0x addresses query all EVM " +
            "chains, base58 addresses query Solana. Example: ethereum.",
    ).optional(),
    fields: z.string().min(1).describe(
        "Comma-separated sub-resources to include. Valid: balance, " +
            "tokens, labels, nft, approvals. The active_chains field is " +
            "always returned. approvals is opt-in (not in default) as it " +
            "triggers additional upstream calls. Example: " +
            "balance,labels,approvals. Defaults to " +
            '"balance,tokens,labels,nft".',
    ).optional(),
}).strict();
