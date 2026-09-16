import { z } from "zod";

/** `POST /v1/enrich` — one person anchored to a LinkedIn profile URL. */
export const zPloidEnrichBody = z.strictObject({
    linkedin_url: z.url().describe(
        "Canonical LinkedIn profile URL of the person to enrich — the " +
            "identity anchor.",
    ),
    first_name: z.string().min(1).optional(),
    last_name: z.string().min(1).optional(),
    enrichments: z.array(z.enum(["profile", "email", "phone"])).min(1).max(3)
        .describe(
            "Which components to resolve: profile, email, phone (the vendor " +
                'default is ["profile"]). Each is priced separately and ' +
                "only charged when actually found.",
        ).optional(),
});
