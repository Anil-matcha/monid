import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPloidLinkedinCommentsQueryParams } from "./schema/inputs.ts";

/** `GET /v1/linkedin/profiles/comments` — provider-neutral untyped payload
 *  (upstream `additionalProperties: true`), passed through unshaped. */
export default defineEndpoint({
    meta: {
        displayName: "List Profile Comments",
        summary: "List the comments a LinkedIn profile has left on posts.",
        description: "Read the comments one LinkedIn profile has written " +
            "across LinkedIn, by profile URL/handle or socialId. Returns " +
            "the provider's comment records (shape varies by comment " +
            "context) with pagination via page or a continuation token, " +
            "and an optional recency window (postedLimit). Suited for " +
            "understanding what a prospect engages with and finding warm " +
            "conversation openers.",
        docsUrl: "https://ploid.com/documentation/api/social",
        categories: ["linkedin"],
    },
    request: { method: "GET", path: "/v1/linkedin/profiles/comments" },
    input: { schema: { queryParams: zPloidLinkedinCommentsQueryParams } },
    usage: {
        // 0.06 ACU per read — see linkedin-profile
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "reads",
            consumes: { credit: "default", amount: 0.06 },
        },
    },
});
