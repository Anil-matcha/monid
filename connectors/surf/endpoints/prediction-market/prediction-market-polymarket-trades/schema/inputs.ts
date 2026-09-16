import { z } from "zod";

/** GET /prediction-market/polymarket/trades query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zPredictionMarketPolymarketTradesQueryParams = z.object({
    condition_id: z.string().min(1).describe(
        "Market condition identifier. Example: " +
            "0x6fefc0438c7598b23531457c8c60541990d0786bd4bd9dfc3eabc8d95c291092.",
    ).optional(),
    address: z.string().min(1).describe(
        "Wallet address — returns trades where the address is maker or taker.",
    ).optional(),
    type: z.enum(["trade", "redemption", "all"]).describe(
        "Filter by activity type: trade (default, spot trades only), " +
            "redemption (splits/merges/redemptions), or all (all " +
            "activity). Use redemption or all to get non-trade wallet " +
            "activity; address is required for these types. Defaults to " +
            '"trade".',
    ).optional(),
    outcome_label: z.enum(["Yes", "No"]).describe(
        "Filter by outcome label: Yes or No.",
    ).optional(),
    min_amount: z.number().min(0).describe(
        "Minimum trade amount in USD.",
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
    limit: z.number().int().min(1).max(500).describe(
        "Results per page. Example: 50. Defaults to 50.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
}).strict();
