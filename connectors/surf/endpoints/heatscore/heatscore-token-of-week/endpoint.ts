import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zHeatscoreTokenOfWeekQueryParams } from "./schema/inputs.ts";

/**
 * GET /heatscore/token-of-week — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Signal Token Of The Week",
        summary: "Returns the token-of-week project signal cards with " +
            "latest price, price-change percentages, dimension " +
            "scores, compact signals, and AI summaries.",
        description: "Returns the token-of-week project signal cards with " +
            "latest price, price-change percentages, dimension " +
            "scores, compact signals, and AI summaries. Supports " +
            "limit/offset pagination.",
        docsUrl: "https://docs.asksurf.ai/data-api/signal/token-of-week",
        categories: ["crypto-signals"],
    },
    request: { method: "GET", path: "/heatscore/token-of-week" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zHeatscoreTokenOfWeekQueryParams.extend({
                limit: zHeatscoreTokenOfWeekQueryParams.shape.limit.unwrap()
                    .default(20),
                offset: zHeatscoreTokenOfWeekQueryParams.shape.offset.unwrap()
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
