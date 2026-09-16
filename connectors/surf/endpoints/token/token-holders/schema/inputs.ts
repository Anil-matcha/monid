import { z } from "zod";

/** GET /token/holders query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zTokenHoldersQueryParams = z.object({
    address: z.string().min(1).describe(
        "Token CONTRACT ADDRESS — 0x-prefixed hex for EVM chains, " +
            "base58 for Solana. This is NOT a ticker symbol (e.g. do NOT " +
            "pass USDC or BTC). To resolve a ticker symbol to a contract " +
            "address, call GET /v1/search/token?q={symbol}&chain={chain} " +
            "and use the address whose chain is supported by this " +
            "endpoint. This endpoint has no symbol parameter. Example: " +
            "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.",
    ),
    chain: z.enum([
        "ethereum",
        "polygon",
        "bsc",
        "solana",
        "avalanche",
        "arbitrum",
        "optimism",
        "base",
    ]).describe(
        "Chain. Can be ethereum, polygon, bsc, solana, avalanche, " +
            "arbitrum, optimism, or base. Example: ethereum.",
    ),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Example: 20. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
    include: z.string().min(1).describe(
        "Comma-separated enrichments to attach to each holder. " +
            "Currently valid: labels — adds a full label record " +
            "alongside the flat entity_name / entity_type fields. " +
            "Example: labels.",
    ).optional(),
}).strict();
