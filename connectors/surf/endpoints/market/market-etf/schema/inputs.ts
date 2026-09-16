import { z } from "zod";

/** GET /market/etf query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zMarketEtfQueryParams = z.object({
    symbol: z.enum(["BTC", "ETH", "XRP", "SOL", "HYPE"]).describe(
        "Token symbol. Can be BTC, ETH, XRP, SOL, or HYPE. Example: BTC.",
    ),
    sort_by: z.enum(["flow_usd", "timestamp"]).describe(
        "Field to sort results by. Example: timestamp. Defaults to " +
            '"timestamp".',
    ).optional(),
    order: z.enum(["asc", "desc"]).describe(
        'Sort order. Example: desc. Defaults to "desc".',
    ).optional(),
    from: z.string().min(1).describe(
        "Start of time range. Accepts Unix seconds or date string " +
            "(YYYY-MM-DD). Example: 2026-01-01.",
    ).optional(),
    to: z.string().min(1).describe(
        "End of time range. Accepts Unix seconds or date string " +
            "(YYYY-MM-DD). Example: 2026-03-01.",
    ).optional(),
}).strict();
