import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zHeatscoreProjectsQueryParams } from "./schema/inputs.ts";

/**
 * GET /heatscore/projects — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Signal Projects",
        summary: "Returns a paginated ranked snapshot of project signal cards.",
        description: "Returns a paginated ranked snapshot of project signal " +
            "cards. Included fields: project identity, score, latest " +
            "price, price-change percentages, core state, dimension " +
            "scores, compact token signals, AI summaries, and " +
            "supporting market metrics. Filters: time_range (24h or " +
            "7d). Supports limit/offset pagination.",
        docsUrl: "https://docs.asksurf.ai/data-api/signal/projects",
        categories: ["crypto-signals"],
    },
    request: { method: "GET", path: "/heatscore/projects" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zHeatscoreProjectsQueryParams.extend({
                time_range: zHeatscoreProjectsQueryParams.shape.time_range
                    .unwrap().default("24h"),
                limit: zHeatscoreProjectsQueryParams.shape.limit.unwrap()
                    .default(20),
                offset: zHeatscoreProjectsQueryParams.shape.offset.unwrap()
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
