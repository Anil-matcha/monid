import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPloidLinkedinProfileQueryParams } from "./schema/inputs.ts";

/** `GET /v1/linkedin/profile` — typed full profile, no cookies or proxies.
 *  A miss is an upstream 404 (`profile_not_found`): data, zero usage. */
export default defineEndpoint({
    meta: {
        displayName: "Fetch Public Profile",
        summary:
            "Fetch a full LinkedIn profile by URL, vanity slug, or @handle.",
        description: "Read one public LinkedIn profile without cookies or " +
            "proxies. Returns full name, headline, summary, location, " +
            "country code, industry, follower and connection counts, " +
            "profile and cover picture URLs, current position, complete " +
            "position history with dates and descriptions, education, " +
            "open-to-work and premium flags. Suited for verifying a " +
            "person's current role, profiling a prospect before outreach, " +
            "and anchoring further enrichment.",
        docsUrl: "https://ploid.com/documentation/api/social",
        categories: ["linkedin"],
    },
    request: { method: "GET", path: "/v1/linkedin/profile" },
    input: { schema: { queryParams: zPloidLinkedinProfileQueryParams } },
    usage: {
        // 0.06 ACU per read — the partnership rate (settled 2026-09-01,
        // USD 0.006 = 0.06 ACU) and what the meter reports (drill
        // 2026-09-05). Shared by the five flat LinkedIn reads.
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "reads",
            consumes: { credit: "default", amount: 0.06 },
        },
    },
});
