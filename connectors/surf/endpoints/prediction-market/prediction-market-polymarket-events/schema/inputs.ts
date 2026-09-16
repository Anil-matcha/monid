import { z } from "zod";

/** GET /prediction-market/polymarket/events query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zPredictionMarketPolymarketEventsQueryParams = z.object({
    event_slug: z.string().min(1).describe(
        "Polymarket event slug (identifies a multi-outcome question " +
            "with several nested markets). Known World Cup match sibling " +
            "slugs are expanded to the canonical match group. Discover " +
            "slugs via " +
            "/v1/search/prediction-market?platform=polymarket&q={keyword}. " +
            "For a single Yes/No market, use /polymarket/markets with " +
            "market_slug instead — this endpoint only accepts " +
            "event_slug, not market_slug. Example: " +
            "what-price-will-bitcoin-hit-before-2027.",
    ),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Example: 20. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
}).strict();
