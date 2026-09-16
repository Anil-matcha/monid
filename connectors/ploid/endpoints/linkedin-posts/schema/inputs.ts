import { z } from "zod";

/** `GET /v1/linkedin/posts` — a profile's recent posts. */
export const zPloidLinkedinPostsQueryParams = z.strictObject({
    identifier: z.string().min(1).describe(
        "LinkedIn profile URL, vanity slug, or @handle.",
    ),
    limit: z.number().int().min(1).max(20).describe(
        "Max posts to return. Default 10, max 20.",
    ).optional(),
});
