import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zSearchFundraisingQueryParams } from "./schema/inputs.ts";

/**
 * GET /search/fundraising — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Fundraising Event Search",
        summary: "Searches source-backed fundraising and token-sale " +
            "events, or returns the latest fundraising timeline when " +
            "q is omitted.",
        description: "Searches source-backed fundraising and token-sale " +
            "events, or returns the latest fundraising timeline when " +
            "q is omitted. Supports inclusive UTC time bounds, " +
            "source and importance filters, localization, " +
            "deterministic sorting, and offset pagination. Results " +
            "intentionally omit project or fundraiser identity " +
            "because source context is not guaranteed to identify " +
            "the organization raising funds.",
        categories: ["company-enrichment", "funding-data"],
    },
    request: { method: "GET", path: "/search/fundraising" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zSearchFundraisingQueryParams.extend({
                lang: zSearchFundraisingQueryParams.shape.lang.unwrap().default(
                    "en",
                ),
                sort_by: zSearchFundraisingQueryParams.shape.sort_by.unwrap()
                    .default("recency"),
                order: zSearchFundraisingQueryParams.shape.order.unwrap()
                    .default("desc"),
                limit: zSearchFundraisingQueryParams.shape.limit.unwrap()
                    .default(20),
                offset: zSearchFundraisingQueryParams.shape.offset.unwrap()
                    .default(0),
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
