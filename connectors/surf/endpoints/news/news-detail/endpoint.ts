import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zNewsDetailQueryParams } from "./schema/inputs.ts";

/**
 * GET /news/detail — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "News Article Detail",
        summary: "Returns the full content of a single news article by " +
            "its ID (returned as id in feed and search results).",
        description: "Returns the full content of a single news article by " +
            "its ID (returned as id in feed and search results).",
        docsUrl: "https://docs.asksurf.ai/data-api/news/detail",
        categories: ["news-search"],
    },
    request: { method: "GET", path: "/news/detail" },
    input: {
        schema: {
            queryParams: zNewsDetailQueryParams,
        },
    },
    usage: {
        // Surf's published Light tier — v1 makePerCallPrice(surfCredits(1)),
        // the balance-differencing drills of 2026-08 (design D1)
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "call",
            consumes: { credit: "default", amount: 1 },
        },
    },
});
