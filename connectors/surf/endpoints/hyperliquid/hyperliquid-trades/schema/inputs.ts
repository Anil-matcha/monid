import { z } from "zod";

/** GET /hyperliquid/trades query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zHyperliquidTradesQueryParams = z.object({
    address: z.string().min(1).describe(
        "Wallet address: a 0x EVM address or an ENS name (e.g. " +
            "vitalik.eth). Solana addresses are not supported.",
    ),
    from: z.string().min(1).describe(
        "Window start: Unix seconds, an ISO datetime " +
            "(2026-03-01T12:00:00Z), or a bare date (= midnight UTC). " +
            "Omit for the full history. Example: 2026-03-01.",
    ).optional(),
    to: z.string().min(1).describe(
        "Window end, inclusive: Unix seconds, an ISO datetime, or a " +
            "bare date — a bare date means the END of that UTC day, so " +
            "from=X&to=X covers the whole day X. Defaults to now. " +
            "Example: 2026-03-01.",
    ).optional(),
    cursor: z.string().min(1).describe(
        "Opaque continuation token from a previous response's " +
            "meta.next_cursor. It encodes the window, position, and " +
            "address, so pass it with only address + limit — and only " +
            "with the address it was issued for. Tokens are single-use " +
            "opaque values: identical requests mint different tokens " +
            "that decode to the same position.",
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Page size (1-100). Defaults to 20.",
    ).optional(),
}).strict();
