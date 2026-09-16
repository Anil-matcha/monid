import { z } from "zod";

/** GET /hyperliquid/positions query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zHyperliquidPositionsQueryParams = z.object({
    address: z.string().min(1).describe(
        "Wallet address: a 0x EVM address or an ENS name (e.g. " +
            "vitalik.eth). Solana addresses are not supported.",
    ),
    dex: z.enum([
        "main_dex",
        "xyz",
        "flx",
        "vntl",
        "hyna",
        "km",
        "abcd",
        "cash",
        "para",
        "mkts",
    ]).describe(
        "Market scope: omit (or main_dex) for the native market, or " +
            "a builder market — one of: xyz, flx, vntl, hyna, km, abcd, " +
            "cash, para, mkts.",
    ).optional(),
}).strict();
