import { z } from "zod";

/** GET /prediction-market/kalshi/prices query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zPredictionMarketKalshiPricesQueryParams = z.object({
    ticker: z.string().min(1).describe(
        "Market ticker identifier. Use GET " +
            "/v1/prediction-market/kalshi/markets or GET " +
            "/v1/search/prediction-market?platform=kalshi&q={keyword} to " +
            "discover valid tickers. Example: " +
            "KXBTC2026250-27JAN01-250000.",
    ),
    time_range: z.enum(["7d", "30d", "90d", "180d", "1y"]).describe(
        "Window of history to return: 7d, 30d, 90d, 180d, or 1y. " +
            "Ignored when interval=latest. Distinct from interval (which " +
            "sets bucket size within the window). Example: 30d. Defaults " +
            'to "30d".',
    ).optional(),
    interval: z.enum(["1h", "1d", "latest"]).describe(
        "Bucket size for each point in the series: 1h (hourly OHLC), " +
            "1d (daily OHLC), or latest (single most-recent trade " +
            "price). Distinct from time_range (window size). Example: " +
            '1d. Defaults to "1d".',
    ).optional(),
}).strict();
