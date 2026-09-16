import { z } from "zod";
import { zLinkedInProfileUrl } from "../../../schema/common.ts";

/** GET /v1/linkedin/enrich query (ported from v1; identical for both key
 *  variants). Faithful mirror: `profile_only` optional, its vendor default
 * (false) applied at the binding. */
export const zLinkedinEnrichQueryParams = z.object({
    profile: zLinkedInProfileUrl,
    profile_only: z.boolean().describe(
        "If true, returns the profile WITHOUT contact information and " +
            "bills one search credit instead of email/phone credits. " +
            "Default false.",
    ).optional(),
}).strict();
