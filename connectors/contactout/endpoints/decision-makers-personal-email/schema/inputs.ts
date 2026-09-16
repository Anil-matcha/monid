import { z } from "zod";

/** GET /v1/people/decision-makers query (ported from v1; identical for
 *  both key variants). Every identifier is optional in the mirror; the
 *  vendor's "at least one of linkedin_url, domain, or name" binds at the
 *  endpoint as a compiled `anyOf`. */
export const zDecisionMakersQueryParams = z.object({
    linkedin_url: z.string().regex(
        /^https?:\/\/.*linkedin\.com\/company\//,
        "Must be a LinkedIn company URL (linkedin.com/company/...).",
    ).describe("The company's LinkedIn URL — name or numeric form.")
        .optional(),
    domain: z.string().min(1).describe(
        "The company's website domain, e.g. 'example.com'.",
    ).optional(),
    name: z.string().min(1).describe("The company name.").optional(),
    page: z.number().int().min(1).describe("Result page to return.")
        .optional(),
    reveal_info: z.boolean().describe(
        "If true, contact_info carries the actual emails and phone " +
            "numbers and email/phone units bill per profile where found. " +
            "Default false.",
    ).optional(),
}).strict();

export const AT_LEAST_ONE_COMPANY_IDENTIFIER =
    "Provide at least one of linkedin_url, domain, or name; combinations " +
    "improve the company match.";
