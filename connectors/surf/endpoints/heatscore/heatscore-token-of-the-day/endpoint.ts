import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zHeatscoreTokenOfTheDayQueryParams } from "./schema/inputs.ts";

/**
 * GET /heatscore/token-of-the-day — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Signal Token Of The Day",
        summary: "Returns the token-of-the-day project signal cards with " +
            "latest price, price-change percentages, dimension " +
            "scores, compact signals, and AI summaries.",
        description: "Returns the token-of-the-day project signal cards with " +
            "latest price, price-change percentages, dimension " +
            "scores, compact signals, and AI summaries. Supports " +
            "limit/offset pagination.",
        docsUrl: "https://docs.asksurf.ai/data-api/signal/token-of-the-day",
        categories: ["crypto-signals"],
    },
    request: { method: "GET", path: "/heatscore/token-of-the-day" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zHeatscoreTokenOfTheDayQueryParams.extend({
                limit: zHeatscoreTokenOfTheDayQueryParams.shape.limit.unwrap()
                    .default(20),
                offset: zHeatscoreTokenOfTheDayQueryParams.shape.offset.unwrap()
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
