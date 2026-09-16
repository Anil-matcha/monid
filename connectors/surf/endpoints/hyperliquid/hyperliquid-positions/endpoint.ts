import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zHyperliquidPositionsQueryParams } from "./schema/inputs.ts";

/**
 * GET /hyperliquid/positions — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Open Positions",
        summary: "Returns a wallet's open perpetual positions with its " +
            "cross-margin summary and derived risk (leverage, " +
            "unrealized PnL, ROE, liquidation price, margin ratio, " +
            "distance-to-liquidation).",
        description: "Returns a wallet's open perpetual positions with its " +
            "cross-margin summary and derived risk (leverage, " +
            "unrealized PnL, ROE, liquidation price, margin ratio, " +
            "distance-to-liquidation). liquidation_price (and " +
            "distance_to_liquidation) can be null even on a " +
            "leveraged position — Hyperliquid returns none for cross " +
            "positions whose spot collateral backstops them; in that " +
            "case use the account-level margin_ratio (the account " +
            "liquidates as it approaches 1.0) for proximity. " +
            "account_value here is perp clearinghouse equity, not " +
            "total portfolio (see /hyperliquid/account). Positions " +
            "are sorted by position value (largest first). dex " +
            "scopes to a builder market; omit (or main_dex) for the " +
            "native market.",
        docsUrl: "https://docs.asksurf.ai/data-api/hyperliquid/positions",
        categories: ["derivatives"],
    },
    request: { method: "GET", path: "/hyperliquid/positions" },
    input: {
        schema: {
            queryParams: zHyperliquidPositionsQueryParams,
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
