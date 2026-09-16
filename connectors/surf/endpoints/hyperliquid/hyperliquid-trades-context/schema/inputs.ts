import { z } from "zod";

/** GET /hyperliquid/trades/context query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zHyperliquidTradesContextQueryParams = z.object({
    address: z.string().min(1).describe(
        "Wallet address: a 0x EVM address or an ENS name (e.g. " +
            "vitalik.eth). Solana addresses are not supported.",
    ),
    symbol: z.string().min(1).describe(
        "Hyperliquid perpetual market id, including a builder prefix " +
            "for HIP-3 markets (for example xyz:GOLD).",
    ),
    direction: z.enum(["long", "short"]).describe(
        "Opening direction of the episode.",
    ),
    open_time: z.number().int().min(1).describe(
        "Episode open time, Unix seconds, copied from GET /hyperliquid/trades.",
    ),
    close_time: z.number().int().min(1).describe(
        "Episode close time, Unix seconds, copied from GET /hyperliquid/trades.",
    ),
}).strict();
