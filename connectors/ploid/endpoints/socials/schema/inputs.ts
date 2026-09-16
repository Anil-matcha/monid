import { z } from "zod";

/** `POST /v1/socials` — one public social profile by handle or URL. */
export const zPloidSocialsBody = z.strictObject({
    platform: z.enum([
        "linkedin",
        "x",
        "instagram",
        "tiktok",
        "youtube",
        "github",
        "reddit",
        "facebook",
    ]).describe("The social platform the identifier belongs to."),
    identifier: z.string().min(1).max(500).describe(
        "Handle, vanity slug, or full profile URL. A URL's domain must " +
            "match the selected platform.",
    ),
});
