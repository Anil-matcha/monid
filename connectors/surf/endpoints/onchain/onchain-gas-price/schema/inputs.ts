import { z } from "zod";

/** GET /onchain/gas-price query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zOnchainGasPriceQueryParams = z.object({
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
}).strict();
