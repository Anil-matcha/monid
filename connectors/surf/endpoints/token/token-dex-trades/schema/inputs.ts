import { z } from "zod";

/** GET /token/dex-trades query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zTokenDexTradesQueryParams = z.object({
    address: z.string().min(1).describe(
        "Token CONTRACT ADDRESS — 0x-prefixed hex (EVM chains only; " +
            "Tron also accepts base58 T...). This is NOT a ticker symbol " +
            "(e.g. do NOT pass USDC or BTC). To resolve a ticker symbol " +
            "to a contract address, call GET " +
            "/v1/search/token?q={symbol}&chain={chain} and use the " +
            "address whose chain is supported by this endpoint. This " +
            "endpoint has no symbol parameter. Example: " +
            "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.",
    ),
    chain: z.enum(["ethereum", "base", "bsc", "arbitrum", "tron"]).describe(
        "Chain. Can be ethereum, base, bsc, arbitrum, or tron. " +
            'Example: ethereum. Defaults to "ethereum".',
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Example: 20. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
    include: z.string().min(1).describe(
        "Comma-separated enrichments to attach to each trade. " +
            "Currently valid: labels — adds a taker_label field with " +
            "entity information for the taker address. Example: labels.",
    ).optional(),
}).strict();
