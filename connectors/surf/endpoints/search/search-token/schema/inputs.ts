import { z } from "zod";

/** GET /search/token query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zSearchTokenQueryParams = z.object({
    q: z.string().min(2).max(100).describe(
        "Exact token ticker symbol to resolve (case-insensitive), " +
            "like USDC or PEPE. NOT a contract address, trading pair, or " +
            "fuzzy token name. Example: USDC.",
    ),
    chain: z.enum([
        "ethereum",
        "base",
        "bsc",
        "arbitrum",
        "solana",
        "polygon",
        "optimism",
        "avalanche",
        "fantom",
        "tron",
        "linea",
        "mantle",
        "blast",
        "gnosis",
        "zksync",
        "scroll",
    ]).describe(
        "Restrict resolution to one supported chain. Omit to search " +
            "all supported chains. Example: solana.",
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Example: 20. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
}).strict();
