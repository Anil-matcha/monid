import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zHyperliquidFillsQueryParams } from "./schema/inputs.ts";

/**
 * GET /hyperliquid/fills — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Fills",
        summary: "Returns a wallet's individual fills (fill-level " +
            "executions), newest first by default, with realized " +
            "PnL, fees, and direction (crossed=true marks a taker " +
            "fill that took liquidity).",
        description: "Returns a wallet's individual fills (fill-level " +
            "executions), newest first by default, with realized " +
            "PnL, fees, and direction (crossed=true marks a taker " +
            "fill that took liquidity). For closed round-trip trades " +
            "(one row per open→close position, with per-trade P&L " +
            "incl. funding), use /hyperliquid/trades instead — " +
            "funding is NOT attributable at fill level. Default " +
            "order=desc is a recent-capped window (no offset): up to " +
            "limit of the most-recent fills; page back by setting to " +
            "to the oldest time you received (or to_ms+to_fill_id " +
            "for millisecond-exact paging). For COMPLETE history " +
            "with no cap, use order=asc with from and follow " +
            "meta.next_cursor. symbol filters to one market (applied " +
            "client-side, so with order=desc it only filters the " +
            "recent window — pair with from/to to reach older " +
            "history).",
        docsUrl: "https://docs.asksurf.ai/data-api/hyperliquid/fills",
        categories: ["derivatives"],
    },
    request: { method: "GET", path: "/hyperliquid/fills" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zHyperliquidFillsQueryParams.extend({
                order: zHyperliquidFillsQueryParams.shape.order.unwrap()
                    .default("desc"),
                limit: zHyperliquidFillsQueryParams.shape.limit.unwrap()
                    .default(20),
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
