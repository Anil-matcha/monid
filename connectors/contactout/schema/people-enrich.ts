import { z } from "zod";
import { zEmail, zLinkedInProfileUrl } from "./common.ts";

/**
 * The `POST /v1/people/enrich` body, minus `include` — shared by the work
 * and personal variants, which differ only in the `include` vocabulary
 * (their own email kind + phone). Ported from v1 `endpoints/enrich.ts`.
 *
 * v1 guarded "a primary identifier OR a name plus a secondary parameter"
 * with a `.refine`; that cross-field rule does not survive compilation
 * (a union would need eight arms over twelve fields), so it rides the
 * endpoints' `meta.notes` and upstream's own 400.
 */
export const peopleEnrichShape = {
    linkedin_url: zLinkedInProfileUrl.optional(),
    email: zEmail.describe("Email address.").optional(),
    phone: z.string().min(1).describe(
        "Phone number in international format, e.g. '+14155552671'.",
    ).optional(),
    full_name: z.string().min(1).describe("Full name of the person.")
        .optional(),
    first_name: z.string().min(1).describe(
        "First name (must be used with last_name).",
    ).optional(),
    last_name: z.string().min(1).describe(
        "Last name (must be used with first_name).",
    ).optional(),
    company: z.array(z.string().min(1)).max(10).describe(
        "Company names the person works or worked at.",
    ).optional(),
    company_domain: z.array(z.string().min(1)).max(10).describe(
        "Company domains, e.g. 'stripe.com'.",
    ).optional(),
    education: z.array(z.string().min(1)).max(10).describe(
        "Educational institutions.",
    ).optional(),
    location: z.string().min(1).describe("Location/city.").optional(),
    job_title: z.string().min(1).describe("Job title.").optional(),
} as const;

export const PEOPLE_ENRICH_IDENTIFIER_NOTE =
    "Provide one primary identifier (linkedin_url, email, or phone), OR a " +
    "name (full_name, or first_name + last_name) plus at least one of " +
    "company, company_domain, education, or location. Upstream answers " +
    "400 otherwise.";
