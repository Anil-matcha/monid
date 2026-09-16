import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zHyperliquidPerformanceQueryParams } from "./schema/inputs.ts";

/**
 * GET /hyperliquid/performance — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Trading Performance",
        summary: "Returns the connected user's lifetime " +
            "trading-performance summary — the dashboard header: " +
            "re-rolled realized performance (win rate, profit " +
            "factor, gross/net PnL — funding-excluded, net = gross − " +
            "fees), the live position snapshot, and account value.",
        description: "Returns the connected user's lifetime " +
            "trading-performance summary — the dashboard header: " +
            "re-rolled realized performance (win rate, profit " +
            "factor, gross/net PnL — funding-excluded, net = gross − " +
            "fees), the live position snapshot, and account value. " +
            "This is a lifetime, point-in-time summary: it takes NO " +
            "from/to window (use /hyperliquid/trades for windowed, " +
            "paginated closed trades) and carries NO trade list. " +
            "account_value is the live perp clearinghouse equity " +
            "only — NOT total portfolio; for total equity incl. " +
            "spot/vault use /hyperliquid/account (total_value_usd). " +
            "Sections degrade independently: a failed section is " +
            "named in errors[] and the call still returns 200. A " +
            "genuinely flat perp account returns account_value 0 " +
            "with no errors[]; the field is omitted only when the " +
            "snapshot section degraded (which also adds an errors[] " +
            "entry) — so detect degradation via errors[], not a 0 " +
            "value. NOTE: Surf's own document declares dex on this " +
            "endpoint while also stating they are rejected, so they " +
            "are deliberately NOT accepted here.",
        docsUrl: "https://docs.asksurf.ai/data-api/hyperliquid/performance",
        categories: ["derivatives"],
    },
    request: { method: "GET", path: "/hyperliquid/performance" },
    input: {
        schema: {
            queryParams: zHyperliquidPerformanceQueryParams,
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
