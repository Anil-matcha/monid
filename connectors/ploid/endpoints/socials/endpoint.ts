import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPloidSocialsBody } from "./schema/inputs.ts";

/**
 * `POST /v1/socials` — resolve one public social profile. A miss is an
 * upstream 404 (`profile_not_found`): data, zero usage — exactly the
 * vendor's "not-found responses are not charged".
 */
export default defineEndpoint({
    meta: {
        displayName: "Enrich Social Profile",
        summary:
            "Resolve a public profile from a handle or URL on any of 8 social platforms.",
        description: "Look up one public social profile by handle, vanity " +
            "slug, or profile URL. Returns the platform's public profile " +
            "fields — the shape varies by platform (LinkedIn, X, " +
            "Instagram, TikTok, YouTube, GitHub, Reddit, Facebook). A " +
            "profile that cannot be found returns a 404 error and costs " +
            "nothing. Suited for verifying a person's social presence, " +
            "pulling bio and follower context before outreach, and " +
            "cross-referencing identities across platforms.",
        docsUrl: "https://ploid.com/documentation/api/social",
        categories: ["people-enrichment"],
    },
    request: { method: "POST", path: "/v1/socials" },
    input: { schema: { body: zPloidSocialsBody } },
    usage: {
        /** One profile per successful call at 1 ACU — v1
         *  makePerResultPrice(ploidAcu(1)), success ? 1 : 0. Flat model:
         *  estimate and evidence are compiler-synthesized. */
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "profiles",
            consumes: { credit: "default", amount: 1 },
        },
    },
});
