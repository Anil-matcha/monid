import { z } from "zod";

/** GET /market/liquidation/exchange-list query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zMarketLiquidationExchangeListQueryParams = z.object({
    symbol: z.string().min(1).describe(
        "Token ticker symbol like BTC or ETH. Example: BTC. Defaults " +
            'to "BTC".',
    ).optional(),
    time_range: z.enum(["1h", "4h", "12h", "24h"]).describe(
        "Window to aggregate over for the snapshot: 1h, 4h, 12h, or " +
            "24h. Returns a single snapshot (not a time-series). This " +
            "endpoint uses time_range only — it does NOT accept " +
            'interval. Example: 24h. Defaults to "24h".',
    ).optional(),
    sort_by: z.enum([
        "liquidation_usd",
        "long_liquidation_usd",
        "short_liquidation_usd",
    ]).describe(
        "Field to sort results by. Example: liquidation_usd. " +
            'Defaults to "liquidation_usd".',
    ).optional(),
    order: z.enum(["asc", "desc"]).describe(
        'Sort order. Example: desc. Defaults to "desc".',
    ).optional(),
}).strict();
