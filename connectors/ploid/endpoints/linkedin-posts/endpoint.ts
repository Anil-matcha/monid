import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPloidLinkedinPostsQueryParams } from "./schema/inputs.ts";

/** `GET /v1/linkedin/posts` — flat read; `limit` shapes the page, not the
 *  bill, so it stays optional. */
export default defineEndpoint({
    meta: {
        displayName: "List Profile Posts",
        summary:
            "List a LinkedIn profile's recent posts with engagement counts.",
        description: "Read the recent posts of one LinkedIn profile. " +
            "Returns up to 20 posts with text, post URL, publication date, " +
            "reaction/comment/share counts, post kind (post, share, " +
            "article), author details, and media URL, plus a pagination " +
            "cursor. Suited for gauging what a prospect talks about, " +
            "finding engagement hooks before outreach, and monitoring a " +
            "person's public activity.",
        docsUrl: "https://ploid.com/documentation/api/social",
        categories: ["linkedin"],
    },
    request: { method: "GET", path: "/v1/linkedin/posts" },
    input: { schema: { queryParams: zPloidLinkedinPostsQueryParams } },
    usage: {
        // 0.06 ACU per read — see linkedin-profile
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "reads",
            consumes: { credit: "default", amount: 0.06 },
        },
    },
});
