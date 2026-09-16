import { z } from "zod";

/** POST /search/query-mode body — one advanced-query string. */
export const zSearchCreateBody = z.object({
    query: z.string().min(1).describe(
        "An advanced search query, e.g. 'select from people where " +
            "experiences.any(is_current = true and job_title is_similar_to " +
            '("VP Sales") and company.estimated_employee_count >= 500)\'. ' +
            "Fetch the query reference first for the full field catalog " +
            "and grammar.",
    ),
}).strict();
