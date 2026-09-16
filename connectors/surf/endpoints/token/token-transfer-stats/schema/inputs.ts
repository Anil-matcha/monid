import { z } from "zod";

/** GET /token/transfer-stats query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zTokenTransferStatsQueryParams = z.object({
    address: z.string().min(1).describe(
        "Token CONTRACT ADDRESS (0x-hex for EVM; Tron accepts base58 " +
            "T... or 0x-hex). Not a ticker — resolve a symbol via GET " +
            "/v1/search/token?q={symbol}&chain={chain} and use a " +
            "returned address whose chain is supported by this endpoint. " +
            "Example: 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.",
    ),
    chain: z.enum(["ethereum", "base", "bsc", "arbitrum", "tron"]).describe(
        "Chain the token contract is deployed on. Example: ethereum.",
    ),
    time_range: z.enum(["1d", "7d", "30d", "90d"]).describe(
        'Look-back window (hard 90d cap). Defaults to "7d".',
    ).optional(),
    include: z.string().min(1).describe(
        "Comma-separated extras. series adds a daily trend breakdown " +
            "(volume only). Example: series.",
    ).optional(),
}).strict();
