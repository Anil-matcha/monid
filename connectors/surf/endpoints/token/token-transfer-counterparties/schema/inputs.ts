import { z } from "zod";

/** GET /token/transfer-counterparties query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zTokenTransferCounterpartiesQueryParams = z.object({
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
    direction: z.enum(["to", "from"]).describe(
        "Ranking direction: to = top receivers, from = top senders. " +
            "Example: to.",
    ),
    metric: z.enum(["count", "amount", "amount_usd"]).describe(
        "Ranking key: count = transfer frequency, amount = " +
            "decimal-adjusted token sum, amount_usd = USD value sum (USD " +
            "lags ~3 days; unreliable for recent windows). Defaults to " +
            '"count".',
    ).optional(),
    time_range: z.enum(["1d", "7d", "30d", "90d"]).describe(
        'Look-back window (hard 90d cap). Defaults to "7d".',
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Defaults to 0.",
    ).optional(),
    include: z.string().min(1).describe(
        "Comma-separated enrichments. labels attaches an entity " +
            "label per counterparty. Example: labels.",
    ).optional(),
    exclude_labels: z.string().min(1).describe(
        "Comma-separated entity categories to drop (best-effort): " +
            "cex, router, amm, bridge. Results may be fewer than limit " +
            "when top counterparties are infrastructure. Example: " +
            "cex,router.",
    ).optional(),
}).strict();
