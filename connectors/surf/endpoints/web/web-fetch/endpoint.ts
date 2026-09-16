import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zWebFetchQueryParams } from "./schema/inputs.ts";

/**
 * GET /web/fetch — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Web Page Fetch",
        summary: "Fetches a web page and converts it to clean, " +
            "LLM-friendly markdown.",
        description: "Fetches a web page and converts it to clean, " +
            "LLM-friendly markdown. Options: target_selector — " +
            "extract specific page sections; remove_selector — strip " +
            "unwanted elements Returns 400 if the URL is invalid or " +
            "unreachable.",
        docsUrl: "https://docs.asksurf.ai/data-api/web/fetch",
        categories: ["web-extraction"],
    },
    request: { method: "GET", path: "/web/fetch" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zWebFetchQueryParams.extend({
                timeout: zWebFetchQueryParams.shape.timeout.unwrap().default(
                    30000,
                ),
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
