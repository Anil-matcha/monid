import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPloidLinkedinCompanyQueryParams } from "./schema/inputs.ts";

/** `GET /v1/linkedin/companies/get` — company page, untyped upstream. */
export default defineEndpoint({
    meta: {
        displayName: "Get Company Profile",
        summary:
            "Get a LinkedIn company's public profile by URL, slug, or name.",
        description: "Read one LinkedIn company page by URL, universal name " +
            "(URL slug), or free-text name search. Returns the provider's " +
            "company record — identity, description, and public page " +
            "details as published on LinkedIn. Suited for resolving a " +
            "company's canonical LinkedIn identity, checking firmographic " +
            "context, and anchoring follow-up people searches.",
        docsUrl: "https://ploid.com/documentation/api/social",
        categories: ["linkedin", "company-enrichment"],
    },
    request: { method: "GET", path: "/v1/linkedin/companies/get" },
    input: { schema: { queryParams: zPloidLinkedinCompanyQueryParams } },
    usage: {
        // 0.06 ACU per read — see linkedin-profile
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "reads",
            consumes: { credit: "default", amount: 0.06 },
        },
    },
});
