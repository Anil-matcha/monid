import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zNewsFeedQueryParams } from "./schema/inputs.ts";

/**
 * GET /news/feed — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Crypto News Feed",
        summary: "Returns crypto news from major sources.",
        description:
            "Returns crypto news from major sources. Filters: source " +
            "(enum), project, and time range (from/to). Sort: " +
            "recency (default) or trending. Use the detail endpoint " +
            "with article id for full content.",
        docsUrl: "https://docs.asksurf.ai/data-api/news/feed",
        categories: ["news-search"],
    },
    request: { method: "GET", path: "/news/feed" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zNewsFeedQueryParams.extend({
                sort_by: zNewsFeedQueryParams.shape.sort_by.unwrap().default(
                    "recency",
                ),
                limit: zNewsFeedQueryParams.shape.limit.unwrap().default(20),
                offset: zNewsFeedQueryParams.shape.offset.unwrap().default(0),
            }),
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
