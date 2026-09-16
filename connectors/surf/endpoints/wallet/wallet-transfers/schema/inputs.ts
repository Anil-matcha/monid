import { z } from "zod";

/** GET /wallet/transfers query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zWalletTransfersQueryParams = z.object({
    address: z.string().min(1).describe(
        "Wallet address — must be a raw address (0x-prefixed hex for " +
            "EVM, base58 for Solana). ENS names like vitalik.eth are not " +
            "supported; resolve to a 0x address first. Example: " +
            "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045.",
    ),
    chain: z.enum(["ethereum", "base", "solana", "tron", "bsc", "arbitrum"])
        .describe(
            "Chain. Can be ethereum, base, solana, tron, bsc, or " +
                'arbitrum. Example: ethereum. Defaults to "ethereum".',
        ).optional(),
    flow: z.enum(["in", "out"]).describe(
        "Filter by transfer direction relative to the queried " +
            "wallet. in for incoming, out for outgoing. Omit for both " +
            "directions. Example: in.",
    ).optional(),
    token: z.string().min(1).describe(
        "Filter by token contract address. Use " +
            "0x0000000000000000000000000000000000000000 for native token " +
            "transfers. Omit for all tokens. Example: " +
            "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48.",
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Default 20, max 100. NOTE: Solana " +
            "(chain=solana) is hard-capped at 40 per call by the " +
            "upstream Solscan API — values above 40 return at most 40 " +
            "items. Check meta.has_more and paginate with offset to " +
            "fetch beyond the first page. Example: 20. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. For Solana, this maps to Solscan's " +
            "1-indexed page parameter (page = offset/page_size + 1). " +
            "Example: 0. Defaults to 0.",
    ).optional(),
    include: z.string().min(1).describe(
        "Comma-separated enrichments to attach to each transfer. " +
            "Currently valid: labels — adds from_label and to_label " +
            "fields with entity information for each counterparty " +
            "address. Example: labels.",
    ).optional(),
}).strict();
