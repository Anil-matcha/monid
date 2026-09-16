import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zHyperliquidOrdersQueryParams } from "./schema/inputs.ts";

/**
 * GET /hyperliquid/orders — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Open & Recent Orders",
        summary: "Returns a wallet's live resting orders (open — stops, " +
            "take-profits, limits, with trigger type) plus its " +
            "recent terminal orders (historical — filled / canceled " +
            "/ rejected).",
        description: "Returns a wallet's live resting orders (open — stops, " +
            "take-profits, limits, with trigger type) plus its " +
            "recent terminal orders (historical — filled / canceled " +
            '/ rejected). Use open for "is a stop set right now?" ' +
            "and historical for the set-then-cancelled timeline. " +
            "Order side is in trade terms (buy/sell), not position " +
            "terms — a sell stop protects a long; join to " +
            "/hyperliquid/positions by symbol. Sections are " +
            "truncated to open_limit (default 500) / " +
            "historical_limit (default 200) — " +
            "open_total/historical_total carry the pre-truncation " +
            "counts. Both sections mix PERP and SPOT orders — check " +
            "market_type: spot orders carry raw spot-pair-index " +
            "symbols (@107) that never join to /positions, /trades, " +
            "or /fills (perp-only surfaces); filter market_type=perp " +
            "for a perp working-orders panel. historical is one row " +
            "per order at its final status, newest first: the " +
            "upstream feed is a status-transition stream (an order " +
            "appears as open, then filled/canceled), so we collapse " +
            "it to the latest status per order id and drop " +
            "still-open orders (those are in the open section) — a " +
            "passthrough would double-count ids and mislabel status. " +
            "Status values pass through Hyperliquid's raw camelCase " +
            "vocabulary: filled, canceled, plus reject variants like " +
            "iocCancelRejected, badAloPxRejected, selfTradeCanceled, " +
            "insufficientSpotBalanceRejected — treat any status " +
            "other than filled/canceled as a rejection bucket. " +
            "Derived from the most-recent ~2000 status updates. The " +
            "two sections fetch independently: a failed section is " +
            "named in errors[] and the call still returns 200 (502 " +
            "only if both fail).",
        docsUrl: "https://docs.asksurf.ai/data-api/hyperliquid/orders",
        categories: ["derivatives"],
    },
    request: { method: "GET", path: "/hyperliquid/orders" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zHyperliquidOrdersQueryParams.extend({
                open_limit: zHyperliquidOrdersQueryParams.shape.open_limit
                    .unwrap().default(500),
                historical_limit: zHyperliquidOrdersQueryParams.shape
                    .historical_limit.unwrap().default(200),
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
