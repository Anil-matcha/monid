import { z } from "zod";

/** GET /prediction-market/kalshi/open-interest query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zPredictionMarketKalshiOpenInterestQueryParams = z.object({
    ticker: z.string().min(1).describe(
        "Market ticker identifier. Use GET " +
            "/v1/prediction-market/kalshi/markets or GET " +
            "/v1/search/prediction-market?platform=kalshi&q={keyword} to " +
            "discover valid tickers. Example: " +
            "KXBTC2026250-27JAN01-250000.",
    ),
    time_range: z.enum(["7d", "30d", "90d", "180d", "1y"]).describe(
        "Window of history to return: 7d, 30d, 90d, 180d, or 1y. " +
            "This endpoint uses time_range only — it does NOT accept " +
            'interval. Example: 30d. Defaults to "30d".',
    ).optional(),
}).strict();
