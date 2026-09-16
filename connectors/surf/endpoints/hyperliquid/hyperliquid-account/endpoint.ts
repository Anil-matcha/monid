import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zHyperliquidAccountQueryParams } from "./schema/inputs.ts";

/**
 * GET /hyperliquid/account — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Account Portfolio",
        summary: "Returns a wallet's full portfolio across perps, spot, " +
            "vaults, and staking in one call, with a perp+vault " +
            "equity roll-up (total_value_usd is the total-equity " +
            "figure a dashboard header should show, vs the perp-only " +
            "equity on /performance and /positions).",
        description: "Returns a wallet's full portfolio across perps, spot, " +
            "vaults, and staking in one call, with a perp+vault " +
            "equity roll-up (total_value_usd is the total-equity " +
            "figure a dashboard header should show, vs the perp-only " +
            "equity on /performance and /positions). This is the " +
            "source for spot balances. This is a point-in-time " +
            "snapshot, not a time series; its perp block duplicates " +
            "the margin summary from /hyperliquid/positions (this " +
            "endpoint adds spot/vault/staking so it stands alone as " +
            "a full-portfolio call). Sections are fetched " +
            "independently: if one fails, that section is omitted " +
            "(not null) and the failure is named in errors[]. The " +
            "call returns 200 when at least one section succeeds, " +
            "and 502 only if all four fail. Spot balances are " +
            "token-denominated and staking is in HYPE.",
        docsUrl: "https://docs.asksurf.ai/data-api/hyperliquid/account",
        categories: ["derivatives"],
    },
    request: { method: "GET", path: "/hyperliquid/account" },
    input: {
        schema: {
            queryParams: zHyperliquidAccountQueryParams,
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
