import { z } from "zod";

/** GET /dex/token/price query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zDexTokenPriceQueryParams = z.object({
    chain: z.enum([
        "ethereum",
        "base",
        "bsc",
        "arbitrum",
        "optimism",
        "polygon",
        "avalanche",
        "solana",
    ]).describe(
        "Chain the token lives on. Can be ethereum, base, bsc, " +
            "arbitrum, optimism, polygon, avalanche, or solana. Example: " +
            "ethereum.",
    ),
    address: z.string().min(1).describe(
        "Token contract address — 0x-prefixed hex (42 chars) for EVM " +
            "chains, base58 for Solana. NOT a ticker symbol. Example: " +
            "0x6982508145454ce325ddbe47a25d4ec3d2311933.",
    ),
    interval: z.enum(["1m", "5m", "15m", "30m", "1h", "4h", "12h", "1d", "7d"])
        .describe(
            "Candle bucket size. Sub-day intervals (1m-4h) are the " +
                "typical choice for active DEX analysis. Example: 1h. " +
                'Defaults to "1h".',
        ).optional(),
    time_range: z.enum([
        "1h",
        "6h",
        "12h",
        "24h",
        "7d",
        "30d",
        "90d",
        "180d",
        "365d",
        "max",
    ]).describe(
        "Window of historical data to return. max returns the " +
            "largest allowed 1500-bar window for the selected interval. " +
            "Ignored when both from and to are set. Example: 24h. " +
            'Defaults to "24h".',
    ).optional(),
    from: z.string().min(1).describe(
        "Start of custom date range (Unix seconds or YYYY-MM-DD). " +
            "Must be set together with to. Overrides time_range when " +
            "set. Example: 2026-01-01.",
    ).optional(),
    to: z.string().min(1).describe(
        "End of custom date range (Unix seconds or YYYY-MM-DD). Must " +
            "be set together with from. Overrides time_range when set. " +
            "Example: 2026-01-02.",
    ).optional(),
}).strict();
