import { z } from "zod";

/** GET /prediction-market/kalshi/trades query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zPredictionMarketKalshiTradesQueryParams = z.object({
    ticker: z.string().min(1).describe(
        "Market ticker identifier. Use GET " +
            "/v1/prediction-market/kalshi/markets or GET " +
            "/v1/search/prediction-market?platform=kalshi&q={keyword} to " +
            "discover valid tickers. Example: " +
            "KXBTC2026250-27JAN01-250000.",
    ),
    taker_side: z.enum(["yes", "no"]).describe(
        "Filter by taker side: yes or no.",
    ).optional(),
    min_amount: z.number().int().min(0).describe(
        "Minimum notional volume in USD (each contract = $1).",
    ).optional(),
    from: z.string().min(1).describe(
        "Start of time range. Accepts Unix seconds (1704067200) or " +
            "date string (2024-01-01).",
    ).optional(),
    to: z.string().min(1).describe(
        "End of time range. Accepts Unix seconds (1706745600) or " +
            "date string (2024-02-01).",
    ).optional(),
    sort_by: z.enum(["timestamp", "notional_volume_usd"]).describe(
        "Field to sort results by. Example: timestamp. Defaults to " +
            '"timestamp".',
    ).optional(),
    order: z.enum(["asc", "desc"]).describe(
        'Sort order. Example: desc. Defaults to "desc".',
    ).optional(),
    limit: z.number().int().min(1).max(500).describe(
        "Results per page. Example: 50. Defaults to 50.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
}).strict();
