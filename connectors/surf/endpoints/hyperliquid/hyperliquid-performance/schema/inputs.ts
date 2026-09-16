import { z } from "zod";

/** GET /hyperliquid/performance query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zHyperliquidPerformanceQueryParams = z.object({
    address: z.string().min(1).describe(
        "Wallet address: a 0x EVM address or an ENS name (e.g. " +
            "vitalik.eth). Solana addresses are not supported.",
    ),
}).strict();
