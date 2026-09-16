import { z } from "zod";

/** GET /prediction-market/kalshi/markets query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zPredictionMarketKalshiMarketsQueryParams = z.object({
    market_ticker: z.string().min(1).describe(
        "Market ticker identifier. When omitted, returns top active " +
            "markets by volume. Use GET " +
            "/v1/search/prediction-market?platform=kalshi&q={keyword} to " +
            "discover valid tickers. Example: " +
            "KXBTC2026250-27JAN01-250000.",
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Example: 20. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
}).strict();
