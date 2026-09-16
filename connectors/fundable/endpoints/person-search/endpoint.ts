import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPersonSearchQueryParams } from "./schema/inputs.ts";

/** GET /person/search — the cheap fuzzy resolver, flat per call. */
export default defineEndpoint({
    meta: {
        displayName: "Look Up Person",
        summary: "Search for a person by name or identifier.",
        description: "Resolve a person from a fuzzy name, a UUID, a LinkedIn " +
            "URL, a Crunchbase URL, or a Twitter URL (exactly one) across " +
            "investors and non-investor people, optionally restricted to " +
            "one pool. Returns up to ten candidates with id, name, " +
            "LinkedIn/Crunchbase/Twitter URLs, and person_type. Flat price " +
            "per call, charged on zero results too. Suited as the cheap " +
            "first step before the person profile, person deals, or " +
            "people-id filters that need a UUID.",
        docsUrl: "https://docs.tryfundable.ai/api-reference/people/search",
        categories: ["funding-data", "people-enrichment"],
    },
    request: { method: "GET", path: "/person/search" },
    input: { schema: { queryParams: zPersonSearchQueryParams } },
    usage: {
        /** 0.1 credit per call, charged on zero results — v1 drill
         *  (2026-09-01). */
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "search",
            consumes: { credit: "default", amount: 0.1 },
        },
    },
});
