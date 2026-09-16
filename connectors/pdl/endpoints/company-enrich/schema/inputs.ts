import { z } from "zod";
import {
    enrichOutputFields,
    zLikelihood,
    zPdlMatch,
} from "../../../schema/common.ts";

/**
 * GET /v5/company/enrich query params (ported from v1's body schema).
 * Identifier rule (documented, design D6): at least one of pdl_id, name,
 * ticker, website, profile.
 *
 * MATCHING fields are LISTS (design D7) — "You can input multiple
 * location values" — while the five the vendor caps at one ("you can only
 * input one") stay single: street_address, locality, region, country,
 * postal_code.
 */
export const zPdlCompanyEnrichQueryParams = z.object({
    pdl_id: zPdlMatch("PDL company id."),
    name: zPdlMatch("Company name."),
    profile: zPdlMatch("LinkedIn company URL."),
    ticker: zPdlMatch("Stock ticker."),
    website: zPdlMatch("Company website."),
    location: zPdlMatch("Free-text location."),
    street_address: z.string().optional(),
    locality: z.string().optional().describe("City."),
    region: z.string().optional().describe("State or region."),
    country: z.string().optional(),
    postal_code: z.string().optional(),
    min_likelihood: zLikelihood.optional(),
    ...enrichOutputFields,
}).strict().describe(
    "Provide at least one of pdl_id, name, ticker, website, profile. PDL " +
        "answers 400 otherwise.",
);
