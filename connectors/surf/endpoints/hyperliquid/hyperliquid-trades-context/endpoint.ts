import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zHyperliquidTradesContextQueryParams } from "./schema/inputs.ts";

/**
 * GET /hyperliquid/trades/context — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Closed Trade Funding and Leverage",
        summary: "Returns immutable funding and leverage context for one " +
            "closed trade identified by the composite key from " +
            "/hyperliquid/trades.",
        description: "Returns immutable funding and leverage context for one " +
            "closed trade identified by the composite key from " +
            "/hyperliquid/trades. Use this for a selected trade " +
            "detail instead of enriching every history row. " +
            "funding_status=complete distinguishes a real zero from " +
            "unavailable historical data; leverage fields are " +
            "omitted when the completed-trade source has no value.",
        categories: ["derivatives"],
    },
    request: { method: "GET", path: "/hyperliquid/trades/context" },
    input: {
        schema: {
            queryParams: zHyperliquidTradesContextQueryParams,
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
