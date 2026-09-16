import { z } from "zod";

/** `GET /v1/linkedin/profiles/comments` — the comments a profile has left.
 *  v1's "profile or profileId" refinement does not survive compilation
 *  (design D6 of the second wave); the vendor 422s a request with neither. */
export const zPloidLinkedinCommentsQueryParams = z.strictObject({
    profile: z.string().min(1).describe(
        "LinkedIn profile URL, vanity slug, or @handle.",
    ).optional(),
    profileId: z.string().min(1).describe(
        "The profile's socialId from a previous read.",
    ).optional(),
    postedLimit: z.string().min(1).describe(
        "Recency window for the comments, e.g. '1 month'.",
    ).optional(),
    page: z.string().min(1).optional(),
    paginationToken: z.string().min(1).describe(
        "Continuation token from a previous response.",
    ).optional(),
}).describe("Provide profile or profileId.");
