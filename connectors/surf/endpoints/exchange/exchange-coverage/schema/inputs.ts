import { z } from "zod";

/** GET /exchange/coverage query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zExchangeCoverageQueryParams = z.object({
    exchange: z.enum([
        "bithumb",
        "upbit",
        "hashkey",
        "bitflyer",
        "coinone",
        "korbit",
    ]).describe(
        "Exchange identifier. When omitted, returns all supported " +
            "exchanges. Example: bithumb.",
    ).optional(),
    q: z.string().min(1).describe(
        "Free-text search over pair, base currency, or quote " +
            "currency. Example: BTC.",
    ).optional(),
    quote: z.string().min(1).describe(
        "Quote currency filter. Example: KRW.",
    ).optional(),
    type: z.enum(["spot"]).describe(
        'Market type. Example: spot. Defaults to "spot".',
    ).optional(),
    status: z.enum(["active", "inactive"]).describe(
        "Market status filter. Example: active.",
    ).optional(),
    data_status: z.enum([
        "covered",
        "official_empty_all",
        "official_empty_ticker",
        "official_empty_5m",
        "official_empty_weekly",
        "stale_gt_7d",
        "stale_30m_to_7d",
        "recent_but_lt_min_ta_candles",
        "missing_4h",
        "missing_latest_ta",
    ]).describe(
        "Market data coverage status filter. Example: covered.",
    ).optional(),
    sort_by: z.enum([
        "pair",
        "price",
        "change_24h",
        "volume_24h",
        "technical_score",
        "latest_candle_at",
        "status",
    ]).describe(
        'Sort field. Example: pair. Defaults to "pair".',
    ).optional(),
    order: z.enum(["asc", "desc"]).describe(
        'Sort order. Example: asc. Defaults to "asc".',
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Example: 20. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
}).strict();
