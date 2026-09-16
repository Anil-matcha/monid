import { z } from "zod";

/** GET /market/liquidation/order query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zMarketLiquidationOrderQueryParams = z.object({
    exchange: z.enum([
        "Binance",
        "OKX",
        "Bybit",
        "Bitget",
        "Hyperliquid",
        "Gate",
        "HTX",
        "Bitmex",
        "Bitfinex",
        "CoinEx",
        "Aster",
        "Lighter",
    ]).describe(
        "Exchange name. Can be Binance, OKX, Bybit, Bitget, " +
            "Hyperliquid, Gate, HTX, Bitmex, Bitfinex, CoinEx, Aster, or " +
            'Lighter. Example: Binance. Defaults to "Binance".',
    ).optional(),
    symbol: z.string().min(1).describe(
        "Token ticker symbol like BTC or ETH. Example: BTC. Defaults " +
            'to "BTC".',
    ).optional(),
    min_amount: z.string().min(1).describe(
        "Minimum liquidation amount in USD. Example: 10000. Defaults " +
            'to "10000".',
    ).optional(),
    side: z.enum(["long", "short"]).describe(
        "Filter by liquidation side. Omit to return both. Example: long.",
    ).optional(),
    sort_by: z.enum(["usd_value", "timestamp", "price"]).describe(
        'Field to sort results by. Defaults to "timestamp".',
    ).optional(),
    order: z.enum(["asc", "desc"]).describe(
        'Sort order. Defaults to "desc".',
    ).optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Defaults to 0.",
    ).optional(),
    from: z.string().min(1).describe(
        "Start of time range (inclusive). Accepts Unix seconds " +
            "(1704067200) or date string (2024-01-01). Example: " +
            "2024-01-01.",
    ).optional(),
    to: z.string().min(1).describe(
        "End of time range, exclusive (returns rows strictly older " +
            "than to). Accepts Unix seconds (1706745600) or date string " +
            "(2024-02-01). To page backward, set this to the oldest " +
            "returned timestamp + 1 and de-duplicate on order_id. " +
            "Example: 2024-02-01.",
    ).optional(),
}).strict();
