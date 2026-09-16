import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zSearchWebQueryParams } from "./schema/inputs.ts";

/**
 * GET /search/web — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Web Search",
        summary: "Searches web pages, articles, and content by keyword.",
        description: "Searches web pages, articles, and content by keyword. " +
            "Filters: domain via site (e.g. coindesk.com). Included " +
            "fields: titles, URLs, content snippets.",
        docsUrl: "https://docs.asksurf.ai/data-api/search/web",
        categories: ["web-search"],
    },
    request: { method: "GET", path: "/search/web" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zSearchWebQueryParams.extend({
                limit: zSearchWebQueryParams.shape.limit.unwrap().default(20),
                offset: zSearchWebQueryParams.shape.offset.unwrap().default(0),
                include_content: zSearchWebQueryParams.shape.include_content
                    .unwrap().default(false),
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
