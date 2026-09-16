import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zHyperliquidLeaderboardQueryParams } from "./schema/inputs.ts";

/**
 * GET /hyperliquid/leaderboard — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Trader Leaderboard",
        summary: "Returns traders ranked by a chosen performance metric " +
            "(PnL by default), with quality filters to exclude bots " +
            "and brand-new accounts.",
        description: "Returns traders ranked by a chosen performance metric " +
            "(PnL by default), with quality filters to exclude bots " +
            "and brand-new accounts. Each row carries rank (1-based, " +
            "offset-adjusted position in this response's ordering). " +
            "Metric basis — does NOT reconcile with /performance: " +
            "the leaderboard is built on the upstream Hydromancer " +
            "trade model, whose total_pnl is funding-INCLUSIVE over " +
            "an all-markets trade universe, while " +
            "/hyperliquid/performance//trades//trades/aggregate are " +
            "funding-EXCLUDED over our episode warehouse. A " +
            "leaderboard PnL and the same trader's /performance net " +
            "can differ severalfold — do not display them " +
            "side-by-side as the same number. Ranking: sort_by " +
            "(total_pnl, win_rate, volume_traded) over a time_range " +
            "window (1d, 7d, 30d, 90d, all). Always sorted " +
            "descending. Filters: min_trades (defaults to 5; pass 0 " +
            "for the full population), min_days_active, " +
            "min_account_age_days, min_human_score, and dex " +
            "(main_dex or omit for the NATIVE market only — note " +
            "/trades/aggregate omits to ALL markets — or a builder " +
            "market: xyz, flx, vntl, hyna, km, abcd, cash, para, " +
            "mkts). Paginated with limit/offset; meta.total is the " +
            "exact count matching your filters.",
        docsUrl: "https://docs.asksurf.ai/data-api/hyperliquid/leaderboard",
        categories: ["derivatives"],
    },
    request: { method: "GET", path: "/hyperliquid/leaderboard" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zHyperliquidLeaderboardQueryParams.extend({
                time_range: zHyperliquidLeaderboardQueryParams.shape.time_range
                    .unwrap().default("all"),
                sort_by: zHyperliquidLeaderboardQueryParams.shape.sort_by
                    .unwrap().default("total_pnl"),
                min_trades: zHyperliquidLeaderboardQueryParams.shape.min_trades
                    .unwrap().default(5),
                min_days_active: zHyperliquidLeaderboardQueryParams.shape
                    .min_days_active.unwrap().default(0),
                min_account_age_days: zHyperliquidLeaderboardQueryParams.shape
                    .min_account_age_days.unwrap().default(0),
                min_human_score: zHyperliquidLeaderboardQueryParams.shape
                    .min_human_score.unwrap().default(0),
                limit: zHyperliquidLeaderboardQueryParams.shape.limit.unwrap()
                    .default(20),
                offset: zHyperliquidLeaderboardQueryParams.shape.offset.unwrap()
                    .default(0),
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
