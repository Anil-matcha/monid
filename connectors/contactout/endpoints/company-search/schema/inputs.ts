import { z } from "zod";
import { zCompanySize } from "../../../schema/common.ts";

/** POST /v1/company/search body (ported from v1). v1's two `.refine`s
 *  ("at least one filter"; `year_founded_to` requires `year_founded_from`)
 *  are cross-field rules that do not survive compilation — they ride
 *  `meta.notes`, and upstream's own 400. */
export const zCompanySearchBody = z.object({
    linkedin_url: z.array(z.string().min(1)).max(25).describe(
        "Company LinkedIn URLs (name or numeric form). Cannot be " +
            "combined with other filters.",
    ).optional(),
    name: z.array(z.string().min(1)).max(50).describe("Company names.")
        .optional(),
    domain: z.array(z.string().min(1)).max(50).describe("Company domains.")
        .optional(),
    size: z.array(zCompanySize).describe("Headcount ranges.").optional(),
    hq_only: z.boolean().describe(
        "Match locations against headquarters only.",
    ).optional(),
    location: z.array(z.string().min(1)).max(50).describe(
        "Company locations.",
    ).optional(),
    industries: z.array(z.string().min(1)).max(50).describe(
        "Industries (LinkedIn vocabulary, e.g. 'Computer Software').",
    ).optional(),
    technologies: z.array(z.string().min(1)).max(50).describe(
        "Technologies in use. Supports boolean equations with " +
            "capitalized AND/OR/NOT, e.g. 'HubSpot AND AWS'.",
    ).optional(),
    min_revenue: z.number().int().nonnegative().describe(
        "Minimum annual revenue in USD. Accepted values: 1000000, " +
            "5000000, 10000000, 50000000, 100000000, 250000000, " +
            "500000000, 1000000000.",
    ).optional(),
    max_revenue: z.number().int().nonnegative().describe(
        "Maximum annual revenue in USD (same accepted values as " +
            "min_revenue).",
    ).optional(),
    year_founded_from: z.number().int().min(1985).describe(
        "Earliest founding year (min 1985).",
    ).optional(),
    year_founded_to: z.number().int().describe(
        "Latest founding year. Requires year_founded_from.",
    ).optional(),
    page: z.number().int().min(1).describe("Result page to return.")
        .optional(),
}).strict();
