import { z } from "zod";

/** GET /onchain/tx query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zOnchainTxQueryParams = z.object({
    hash: z.string().min(1).describe(
        "Transaction hash (0x-prefixed hex). Example: " +
            "0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060.",
    ),
    chain: z.enum([
        "ethereum",
        "polygon",
        "bsc",
        "arbitrum",
        "optimism",
        "base",
        "avalanche",
        "fantom",
        "linea",
        "cyber",
    ]).describe(
        "Chain. Can be ethereum, polygon, bsc, arbitrum, optimism, " +
            "base, avalanche, fantom, linea, or cyber. Example: " +
            "ethereum.",
    ),
    include: z.string().min(1).describe(
        "Comma-separated enrichments to attach. Currently valid: " +
            "labels — adds from_label and to_label fields with entity " +
            "information for the from/to addresses. Example: labels.",
    ).optional(),
}).strict();
