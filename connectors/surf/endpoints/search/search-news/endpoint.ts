import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zSearchNewsQueryParams } from "./schema/inputs.ts";

/**
 * GET /search/news — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "News Article Search",
        summary: "Searches crypto news articles by keyword.",
        description: "Searches crypto news articles by keyword. Returns " +
            "results ranked by relevance with highlighted matching " +
            "fragments. Supports pagination via limit and offset.",
        docsUrl: "https://docs.asksurf.ai/data-api/search/news",
        categories: ["news-search"],
    },
    request: { method: "GET", path: "/search/news" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zSearchNewsQueryParams.extend({
                limit: zSearchNewsQueryParams.shape.limit.unwrap().default(10),
                offset: zSearchNewsQueryParams.shape.offset.unwrap().default(0),
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
