import { z } from "zod";
import {
    enrichOutputFields,
    zLikelihood,
    zPdlMatch,
} from "../../../schema/common.ts";

/**
 * GET /v5/person/enrich query params (ported from v1's body schema — the
 * SDK put these on the query string; here they ARE the query string).
 * Identifier rule (documented, design D6): provide one of pdl_id, profile,
 * email, phone, email_hash, lid — OR (first_name + last_name, or name)
 * together with one of company, school, location, street_address,
 * locality, region, country, postal_code, birth_date.
 *
 * MATCHING fields are LISTS (design D7): PDL widens a match when a
 * parameter repeats, and the engine sends a list as `?k=a&k=b`. The four
 * the vendor forbids repeating — locality, region, country,
 * street_address — stay single, as do the output-shaping knobs.
 */
export const zPdlPersonEnrichQueryParams = z.object({
    pdl_id: zPdlMatch("PDL person id."),
    name: zPdlMatch("Full name."),
    first_name: zPdlMatch("First name."),
    last_name: zPdlMatch("Last name."),
    middle_name: zPdlMatch("Middle name."),
    location: zPdlMatch("Free-text location."),
    // the vendor's four singles: "linearly related — multiple inputs
    // would make it impossible to match"
    street_address: z.string().optional(),
    locality: z.string().optional().describe("City."),
    region: z.string().optional().describe("State or region."),
    country: z.string().optional(),
    postal_code: zPdlMatch("Postal code."),
    company: zPdlMatch("Current or past employer."),
    school: zPdlMatch("University or college attended."),
    phone: zPdlMatch("Phone number, starting with +[country code]."),
    email: zPdlMatch("Email address."),
    email_hash: zPdlMatch("SHA-256 or MD5 of an email."),
    profile: zPdlMatch(
        "Social profile URL (LinkedIn, Twitter, GitHub, Facebook).",
    ),
    lid: zPdlMatch("LinkedIn numeric id."),
    birth_date: zPdlMatch("Birth date (YYYY or YYYY-MM-DD)."),
    min_likelihood: zLikelihood.optional(),
    ...enrichOutputFields,
}).strict().describe(
    "Provide one of pdl_id, profile, email, phone, email_hash, lid — OR " +
        "(first_name + last_name, or name) together with one of company, " +
        "school, location, street_address, locality, region, country, " +
        "postal_code, birth_date. PDL answers 400 otherwise.",
);
