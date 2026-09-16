import { z } from "zod";
import { enrichOutputFields, zLikelihood } from "../../../schema/common.ts";

/**
 * GET /v5/company/enrich query params (ported from v1's body schema).
 * Identifier rule (documented, design D6): at least one of pdl_id, name,
 * ticker, website, profile.
 */
export const zPdlCompanyEnrichQueryParams = z.object({
    pdl_id: z.string().optional().describe("PDL company id."),
    name: z.string().optional().describe("Company name."),
    profile: z.string().optional().describe("LinkedIn company URL."),
    ticker: z.string().optional().describe("Stock ticker."),
    website: z.string().optional().describe("Company website."),
    location: z.string().optional().describe("Free-text location."),
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
