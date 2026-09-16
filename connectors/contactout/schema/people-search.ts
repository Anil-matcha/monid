import { z } from "zod";
import { zCompanySize } from "./common.ts";

/**
 * The people-search filter vocabulary, shared VERBATIM by
 * `/v1/people/search` (both key variants) and `/v1/people/count` —
 * upstream documents count as "the same parameters except page,
 * data_types, and reveal_info". Ported from v1 `endpoints/search.ts`.
 *
 * Upstream SILENTLY IGNORES unknown parameters (drill-verified byte-equal
 * result sets), so every consumer binds this shape `.strict()`.
 *
 * Two documented pairwise exclusions (`recently_changed_jobs` vs
 * `years_in_current_role`; `match_experience` vs `current_titles_only` /
 * `company_filter`) were v1 `.refine`s. Cross-field rules do not survive
 * compilation, so they ride each endpoint's `meta.notes`; upstream answers
 * a violation with a clear 400 (error-as-data).
 */

const zStringList = (max: number, description: string) =>
    z.array(z.string().min(1)).max(max).describe(description);

export const zLanguageFilter = z.object({
    language: z.string().min(1).describe("Language name, e.g. 'english'."),
    proficiency: z.array(z.enum([
        "elementary",
        "full_professional",
        "limited_working",
        "native_or_bilingual",
        "professional_working",
    ])).describe("Accepted proficiency levels; omit for any.").optional(),
}).strict();

const zYearsRange = (values: string, description: string) =>
    z.string().min(1).describe(
        `${description} Format X_Y (min_max years); accepted values: ` +
            `${values}.`,
    );

/** Free-text-ish filter values where the vendor's published sheet and its
 *  own docs examples disagree on casing — deliberately NOT enum-locked. */
const zSeniorityList = z.array(z.string().min(1)).max(50).describe(
    "Seniority levels: Owner / Founder, CXO, Partner, VP, Head, Director, " +
        "Manager, Senior, Entry, Intern.",
);

const zJobFunctionList = z.array(z.string().min(1)).max(50).describe(
    "Functional areas, e.g. Engineering, Sales, Finance, Marketing, " +
        "Human Resources, Product Management, Operations.",
);

/** The filter fields, as a shape so each consumer spells its own object. */
export const peopleSearchFilterShape = {
    name: z.string().min(1).describe("Name of the person.").optional(),
    job_title: zStringList(
        50,
        "Job titles to match (any one). Supports boolean equations with " +
            "capitalized AND/OR/NOT, e.g. '(CTO OR VP Engineering) NOT " +
            "consultant'.",
    ).optional(),
    past_job_title: zStringList(
        50,
        "Job titles held in past (non-current) roles. Supports boolean " +
            "equations.",
    ).optional(),
    exclude_job_titles: zStringList(
        50,
        "Job titles to exclude from results.",
    ).optional(),
    job_function: zJobFunctionList.optional(),
    seniority: zSeniorityList.optional(),
    current_titles_only: z.boolean().describe(
        "Default true — match current job titles only; false also " +
            "matches past titles.",
    ).optional(),
    include_related_job_titles: z.boolean().describe(
        "Include profiles with related job titles. Default false.",
    ).optional(),
    match_experience: z.enum(["current", "past", "both"]).describe(
        "Require job_title and company to match within the SAME " +
            "experience entry. Cannot be combined with " +
            "current_titles_only or company_filter.",
    ).optional(),
    skills: zStringList(
        50,
        "Skills to match. Supports boolean equations.",
    ).optional(),
    languages: z.array(zLanguageFilter).max(50).describe(
        "Language requirements, each optionally narrowed by proficiency.",
    ).optional(),
    education: zStringList(
        50,
        "Schools or degrees. Supports boolean equations.",
    ).optional(),
    educations: z.array(
        z.object({
            school_name: z.string().min(1).optional(),
            field_of_study: z.string().min(1).optional(),
            location: z.string().min(1).optional(),
        }).strict().describe("Provide at least one education field."),
    ).max(50).describe("Structured education filters.").optional(),
    location: zStringList(50, "Locations of the person.").optional(),
    location_radius: z.number().int().min(1).max(500).describe(
        "Search radius in miles around the given location (city/area " +
            "only).",
    ).optional(),
    current_work_location: zStringList(
        50,
        "Cities or countries where the person currently works.",
    ).optional(),
    past_work_location: zStringList(
        50,
        "Cities or countries where the person previously worked.",
    ).optional(),
    company: zStringList(50, "Company names.").optional(),
    past_company: zStringList(
        50,
        "Companies from past (non-current) roles.",
    ).optional(),
    company_filter: z.enum(["current", "past", "past_only", "both"])
        .describe(
            "How company names match: current employer (default), any " +
                "past employer, past only, or both.",
        ).optional(),
    current_company_only: z.boolean().describe(
        "Default true — match the current company only.",
    ).optional(),
    is_currently_working: z.boolean().describe(
        "true → only profiles with an active current role; false → only " +
            "profiles without one; omit for both.",
    ).optional(),
    exclude_companies: zStringList(
        50,
        "Company names to exclude from results.",
    ).optional(),
    exclude_companies_filter: z.enum(["current", "past", "both"])
        .describe(
            "Where the exclusion applies: current employer, past roles, " +
                "or both (default).",
        ).optional(),
    domain: zStringList(50, "Company domains.").optional(),
    industry: zStringList(
        50,
        "Industries (LinkedIn vocabulary, e.g. 'Computer Software'). " +
            "Prefix a value with NOT to exclude it.",
    ).optional(),
    keyword: z.string().min(1).describe(
        "Keyword matched anywhere in the profile. Supports boolean " +
            "equations.",
    ).optional(),
    company_size: z.array(zCompanySize).describe(
        "Employer headcount ranges.",
    ).optional(),
    years_of_experience: z.array(
        zYearsRange("0_1, 1_2, 3_5, 6_10, 10", "Total years of experience."),
    ).describe("Total-experience ranges to match (any one).").optional(),
    years_in_current_role: z.array(
        zYearsRange(
            "0_2, 2_4, 4_6, 6_8, 8_10, 10",
            "Years in the current role.",
        ),
    ).describe("Cannot be combined with recently_changed_jobs.").optional(),
    recently_changed_jobs: z.boolean().describe(
        "true → only profiles whose current job started within the last " +
            "3 months. Cannot be combined with years_in_current_role.",
    ).optional(),
} as const;

/** Vendor cap on a search page (`page_size`), and the FIXED page size of
 *  `/v1/people/decision-makers` and `/v1/company/search`. */
export const SEARCH_PAGE_SIZE_MAX = 25;

/**
 * The paging / output knobs shared by both `/v1/people/search` variants.
 * `data_types` is NOT here: its vocabulary is the key's own email kind
 * plus phone, so each variant spells it.
 */
export const peopleSearchPageShape = {
    page: z.number().int().min(1).describe("Result page to return.")
        .optional(),
    page_size: z.number().int().min(1).max(SEARCH_PAGE_SIZE_MAX).describe(
        "Profiles per page (1-25, default 25). Search units bill per " +
            "profile actually returned.",
    ).optional(),
    detailed_experience: z.boolean().describe(
        "Return structured experience entries instead of text lines.",
    ).optional(),
    detailed_education: z.boolean().describe(
        "Return structured education entries instead of text lines.",
    ).optional(),
    output_fields: z.array(z.string().min(1)).describe(
        "Restrict profile fields in the response (e.g. 'title', " +
            "'li_vanity', 'full_name'). Invalid names are rejected " +
            "upstream with a clear 400.",
    ).optional(),
} as const;

/** The two documented pairwise exclusions, as `meta.notes` entries. */
export const SEARCH_EXCLUSION_NOTES = [
    "recently_changed_jobs cannot be combined with years_in_current_role " +
    "— upstream answers 400.",
    "match_experience cannot be combined with current_titles_only or " +
    "company_filter — upstream answers 400.",
];
