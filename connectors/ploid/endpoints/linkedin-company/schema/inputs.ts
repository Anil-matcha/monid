import { z } from "zod";

/** `GET /v1/linkedin/companies/get` — one company page. v1's "url,
 *  universalName, or search" refinement is documentation here (D6). */
export const zPloidLinkedinCompanyQueryParams = z.strictObject({
    url: z.string().min(1).describe("LinkedIn company URL.").optional(),
    universalName: z.string().min(1).describe(
        "The company's LinkedIn universal name (URL slug).",
    ).optional(),
    search: z.string().min(1).describe(
        "Free-text company name to resolve.",
    ).optional(),
}).describe("Provide url, universalName, or search.");
