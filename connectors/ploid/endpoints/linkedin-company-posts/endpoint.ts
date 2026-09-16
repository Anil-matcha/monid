import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPloidLinkedinCompanyPostsQueryParams } from "./schema/inputs.ts";

/** `GET /v1/linkedin/companies/posts` — company posts, untyped upstream. */
export default defineEndpoint({
    meta: {
        displayName: "List Company Posts",
        summary: "List a LinkedIn company page's recent posts.",
        description: "Read the recent posts of one LinkedIn company page, " +
            "by company URL/name, socialId, or universal name. Returns the " +
            "provider's post records with pagination via page or a " +
            "continuation token and an optional recency window " +
            "(postedLimit). Suited for tracking a target account's " +
            "announcements, funding and product news, and timing outreach " +
            "to company events.",
        docsUrl: "https://ploid.com/documentation/api/social",
        categories: ["linkedin", "company-enrichment"],
    },
    request: { method: "GET", path: "/v1/linkedin/companies/posts" },
    input: {
        schema: { queryParams: zPloidLinkedinCompanyPostsQueryParams },
    },
    usage: {
        // 0.06 ACU per read — see linkedin-profile
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "reads",
            consumes: { credit: "default", amount: 0.06 },
        },
    },
});
