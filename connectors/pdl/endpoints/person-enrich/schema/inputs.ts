import { z } from "zod";
import { enrichOutputFields, zLikelihood } from "../../../schema/common.ts";

/**
 * GET /v5/person/enrich query params (ported from v1's body schema — the
 * SDK put these on the query string; here they ARE the query string).
 * Identifier rule (documented, design D6): provide one of pdl_id, profile,
 * email, phone, email_hash, lid — OR (first_name + last_name, or name)
 * together with one of company, school, location, street_address,
 * locality, region, country, postal_code, birth_date.
 */
export const zPdlPersonEnrichQueryParams = z.object({
    pdl_id: z.string().optional().describe("PDL person id."),
    name: z.string().optional().describe("Full name."),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    middle_name: z.string().optional(),
    location: z.string().optional().describe("Free-text location."),
    street_address: z.string().optional(),
    locality: z.string().optional().describe("City."),
    region: z.string().optional().describe("State or region."),
    country: z.string().optional(),
    postal_code: z.string().optional(),
    company: z.string().optional().describe("Current or past employer."),
    school: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    email_hash: z.string().optional().describe("SHA-256 or MD5 of an email."),
    profile: z.string().optional().describe(
        "Social profile URL (LinkedIn, Twitter, GitHub, Facebook).",
    ),
    lid: z.string().optional().describe("LinkedIn numeric id."),
    birth_date: z.string().optional(),
    min_likelihood: zLikelihood.optional(),
    ...enrichOutputFields,
}).strict().describe(
    "Provide one of pdl_id, profile, email, phone, email_hash, lid — OR " +
        "(first_name + last_name, or name) together with one of company, " +
        "school, location, street_address, locality, region, country, " +
        "postal_code, birth_date. PDL answers 400 otherwise.",
);
