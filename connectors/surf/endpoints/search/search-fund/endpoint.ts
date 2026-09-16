import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zSearchFundQueryParams } from "./schema/inputs.ts";

/**
 * GET /search/fund — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Fund Search",
        summary: "Searches funds by keyword.",
        description:
            "Searches funds by keyword. Included fields: name, tier, " +
            "type, logo, top invested projects.",
        docsUrl: "https://docs.asksurf.ai/data-api/search/fund",
        categories: ["company-enrichment", "funding-data"],
    },
    request: { method: "GET", path: "/search/fund" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zSearchFundQueryParams.extend({
                limit: zSearchFundQueryParams.shape.limit.unwrap().default(20),
                offset: zSearchFundQueryParams.shape.offset.unwrap().default(0),
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
