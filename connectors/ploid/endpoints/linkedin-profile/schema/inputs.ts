import { z } from "zod";

/** `GET /v1/linkedin/profile` — one public profile by URL, slug, or handle. */
export const zPloidLinkedinProfileQueryParams = z.strictObject({
    url: z.string().min(1).describe(
        "LinkedIn profile URL, vanity slug, or @handle.",
    ),
});
