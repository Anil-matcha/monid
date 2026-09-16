import { z } from "zod";

/** GET /market/listing query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zMarketListingQueryParams = z.object({
    from: z.string().min(1).describe(
        "Start date (YYYY-MM-DD or ISO 8601). Example: 2024-01-01.",
    ),
    to: z.string().min(1).describe(
        "End date (defaults to now). Example: 2024-03-01.",
    ).optional(),
    symbol: z.string().min(1).describe(
        "Filter by token symbol. Example: BTC.",
    ).optional(),
    exchange: z.string().min(1).describe(
        "Filter by exchange name. Example: binance.",
    ).optional(),
    product: z.enum(["spot", "margin", "perp", "pre_market_perp", "all"])
        .describe(
            'Filter by product type. Defaults to "all".',
        ).optional(),
    type: z.enum([
        "listing",
        "delisting",
        "cancelled",
        "advanced",
        "postponed",
    ]).describe(
        'Event type filter. Defaults to "listing".',
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Defaults to 0.",
    ).optional(),
}).strict();
