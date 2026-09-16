import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zSearchProjectQueryParams } from "./schema/inputs.ts";

/**
 * GET /search/project — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Project Search",
        summary: "Searches crypto projects by keyword.",
        description: "Searches crypto projects by keyword. Included fields: " +
            "name, description, chains, logo.",
        docsUrl: "https://docs.asksurf.ai/data-api/search/project",
        categories: ["company-enrichment"],
    },
    request: { method: "GET", path: "/search/project" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zSearchProjectQueryParams.extend({
                limit: zSearchProjectQueryParams.shape.limit.unwrap().default(
                    20,
                ),
                offset: zSearchProjectQueryParams.shape.offset.unwrap().default(
                    0,
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
