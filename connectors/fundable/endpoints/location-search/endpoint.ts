import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zLocationSearchQueryParams } from "./schema/inputs.ts";

/** GET /location/search — the free location permalink resolver. */
export default defineEndpoint({
    meta: {
        displayName: "Resolve Location Permalink",
        summary: "Search locations by name, optionally by level — free.",
        description: "Resolve a plain-English place name (e.g. 'san " +
            "francisco') into the exact location permalinks the deal, " +
            "company, investor and people searches require. Returns " +
            "permalink, name, and location_type (CITY, STATE, REGION, or " +
            "COUNTRY — each level is a distinct permalink such as " +
            "'san-francisco-california' vs 'san-francisco-bay-area'). " +
            "Free. Suited as the mandatory first step before any " +
            "locations filter.",
        docsUrl: "https://docs.tryfundable.ai/api-reference/locations/search",
        categories: ["funding-data"],
    },
    request: { method: "GET", path: "/location/search" },
    input: { schema: { queryParams: zLocationSearchQueryParams } },
    usage: {
        // FREE (designs D25/D27): 0 credits — v1 makePerCallPrice(0),
        // drill-verified "0 credits".
        model: { kind: UsageModelKind.FREE },
    },
});
