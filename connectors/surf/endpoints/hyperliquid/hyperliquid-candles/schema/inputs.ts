import { z } from "zod";

/** GET /hyperliquid/candles query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zHyperliquidCandlesQueryParams = z.object({
    symbol: z.string().min(1).describe(
        "Hyperliquid market id (for example BTC, kPEPE, xyz:GOLD, " +
            "the canonical PURR/USDC spot pair, or an @index spot " +
            "market). Example: SOL.",
    ),
    interval: z.enum([
        "1m",
        "3m",
        "5m",
        "15m",
        "30m",
        "1h",
        "2h",
        "4h",
        "8h",
        "12h",
        "1d",
        "3d",
        "1w",
        "1M",
    ]).describe(
        'Candle granularity. Example: 4h. Defaults to "4h".',
    ).optional(),
    from: z.string().min(1).describe(
        "Window start (Unix seconds, an ISO datetime, or a bare UTC " +
            "date). Example: 2026-05-16.",
    ),
    to: z.string().min(1).describe(
        "Window end (Unix seconds, an ISO datetime, or a bare UTC " +
            "date; a bare date means the end of that day). Example: " +
            "2026-05-19.",
    ),
}).strict();
