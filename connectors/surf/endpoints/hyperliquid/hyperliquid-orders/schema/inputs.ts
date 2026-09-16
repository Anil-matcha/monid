import { z } from "zod";

/** GET /hyperliquid/orders query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zHyperliquidOrdersQueryParams = z.object({
    address: z.string().min(1).describe(
        "Wallet address: a 0x EVM address or an ENS name (e.g. " +
            "vitalik.eth). Solana addresses are not supported.",
    ),
    open_limit: z.number().int().min(1).max(2000).describe(
        "Max open orders returned (market makers can hold 1500+; " +
            "open_total reports the pre-truncation count). Defaults to " +
            "500.",
    ).optional(),
    historical_limit: z.number().int().min(1).max(2000).describe(
        "Max terminal orders returned, newest first (the upstream " +
            "feed holds ~1000 post-collapse; historical_total reports " +
            "the pre-truncation count). Defaults to 200.",
    ).optional(),
}).strict();
