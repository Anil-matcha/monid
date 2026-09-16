import { z } from "zod";

/** GET /prediction-market/polymarket/markets query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zPredictionMarketPolymarketMarketsQueryParams = z.object({
    market_slug: z.string().min(1).describe(
        "Polymarket market slug (identifies a single Yes/No " +
            "outcome). Discover slugs via " +
            "/v1/search/prediction-market?platform=polymarket&q={keyword}. " +
            "For a multi-outcome question (e.g. 'who wins the 2024 " +
            "election'), use the /polymarket/events endpoint with " +
            "event_slug instead. Example: " +
            "will-bitcoin-dip-to-45000-by-december-31-2026-674-923-755-971-998-525-926-245-316-517-544-589-965-923-986-841-815-224.",
    ),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Example: 20. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
}).strict();
