import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zHyperliquidTradesAggregateQueryParams } from "./schema/inputs.ts";

/**
 * GET /hyperliquid/trades/aggregate — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Closed Trades Aggregate",
        summary: "Returns a wallet's closed trades rolled up server-side " +
            "into one row per group — so the P&L calendar, " +
            "per-symbol / direction / size attribution, and the " +
            "realized equity curve are one call each instead of " +
            "paging the whole trade history.",
        description: "Returns a wallet's closed trades rolled up server-side " +
            "into one row per group — so the P&L calendar, " +
            "per-symbol / direction / size attribution, and the " +
            "realized equity curve are one call each instead of " +
            "paging the whole trade history. group_by: day (UTC " +
            "calendar day — the calendar and equity-curve source), " +
            "symbol (per market), direction (long vs short), " +
            "size_bucket (notional-USD tiers: <1k, 1k-10k, 10k-100k, " +
            "100k-1m, 1m+), or hold_bucket (holding-time tiers: <5m, " +
            "5m-1h, 1h-1d, 1d-1w, 1w+). Tiers with no trades are " +
            "omitted — render the full ladder client-side and " +
            "zero-fill. One dimension per call. Per group: " +
            "trade_count, gross_pnl, net_pnl (funding-excluded — " +
            "gross − fees, matching /trades and /performance), fees, " +
            "funding_pnl (live tail only), win_rate, volume_usd " +
            "(notional), avg_win, avg_loss. from/to (Unix seconds or " +
            "a date) bound close_time; omit for full history. Totals " +
            "reconcile to /trades and /performance — all three read " +
            "the same episodes universe (warehouse ≤ watermark plus " +
            "the live gap-fill past it) through one shared " +
            "watermark; only the live gap-fill contributes trades " +
            "past the watermark, and funding_pnl is populated on " +
            "that tail alone. dex scopes to one market (omit to " +
            "aggregate across markets). For group_by=day, " +
            "fill_gaps=true emits zero rows for no-trade days (a " +
            "dense calendar; requires from). Not paginated — every " +
            "group in the window is returned in one response.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/hyperliquid/trades-aggregate",
        categories: ["derivatives"],
    },
    request: { method: "GET", path: "/hyperliquid/trades/aggregate" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zHyperliquidTradesAggregateQueryParams.extend({
                group_by: zHyperliquidTradesAggregateQueryParams.shape.group_by
                    .unwrap().default("day"),
                fill_gaps: zHyperliquidTradesAggregateQueryParams.shape
                    .fill_gaps.unwrap().default(false),
            }),
        },
    },
    usage: {
        // Surf's published Heavy tier — v1 makePerCallPrice(surfCredits(4)),
        // the balance-differencing drills of 2026-08 (design D1)
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "call",
            consumes: { credit: "default", amount: 4 },
        },
    },
});
