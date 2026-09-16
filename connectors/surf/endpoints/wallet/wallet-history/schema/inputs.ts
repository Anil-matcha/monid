import { z } from "zod";

/** GET /wallet/history query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zWalletHistoryQueryParams = z.object({
    address: z.string().min(1).describe(
        "Wallet address — must be a raw 0x-prefixed hex address, not " +
            "an ENS name. Example: " +
            "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045.",
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
    ]).describe(
        "Chain filter. Can be ethereum, polygon, bsc, avalanche, " +
            "arbitrum, optimism, fantom, or base. Example: ethereum. " +
            'Defaults to "ethereum".',
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Example: 20. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. This feed is cursor-paginated upstream " +
            "and only the most recent ~1000 transactions are reachable; " +
            "a larger offset returns an empty page with " +
            "meta.empty_reason rather than an error. For deep history " +
            "prefer the before cursor — its upstream cost is bounded by " +
            "limit and independent of depth, whereas a large offset is " +
            "emulated by walking the whole feed. Example: 0. Defaults to " +
            "0.",
    ).optional(),
    before: z.number().int().min(0).describe(
        "Cursor for efficient deep pagination: return transactions " +
            "strictly older than this Unix-seconds timestamp " +
            "(exclusive). Pass the timestamp of the last item from the " +
            "previous page; if items may share a second, pass that " +
            "timestamp + 1 and de-duplicate on tx_hash. Unlike offset " +
            "(which walks the feed), the number of upstream fetches is " +
            "bounded by limit (DeBank returns up to 20 per page) and " +
            "independent of how far back you page. Mutually exclusive " +
            "with offset. Example: 1704067200.",
    ).optional(),
    sort_by: z.enum(["timestamp", "value"]).describe(
        "Field to sort results by. The cursor-paginated upstream " +
            "feed only supports timestamp correctly; unsupported values " +
            "are rejected by the handler for correctness. Example: " +
            'timestamp. Defaults to "timestamp".',
    ).optional(),
    order: z.enum(["asc", "desc"]).describe(
        "Sort order. The cursor-paginated upstream feed only " +
            "supports desc correctly; unsupported values are rejected by " +
            "the handler for correctness. Example: desc. Defaults to " +
            '"desc".',
    ).optional(),
    include: z.string().min(1).describe(
        "Comma-separated enrichments to attach to each item. " +
            "Currently valid: labels — adds from_label and to_label " +
            "fields with entity information for each counterparty " +
            "address. Example: labels.",
    ).optional(),
}).strict();
