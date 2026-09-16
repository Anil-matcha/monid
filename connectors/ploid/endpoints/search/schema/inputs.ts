import { z } from "zod";

/** `POST /v1/search` — the vendor OpenAPI declares `additionalProperties:
 *  false` (unknown fields 422), so the mirror is strict at every level: a
 *  typo inside `filters` must fail INVALID_INPUT, not run an unfiltered
 *  paid search. `category` is a const-"people" upstream field with that
 *  default — not exposed. */
export const zPloidSearchBody = z.strictObject({
    query: z.string().min(1).max(4000).describe(
        "Who to find, in plain English — e.g. 'software engineers at " +
            "fintech companies in San Francisco'.",
    ),
    type: z.enum(["instant", "auto", "deep"]).describe(
        "instant = retrieve quickly; auto (default) = retrieve and " +
            "rerank; deep = apply a deeper grading path.",
    ).optional(),
    num_results: z.number().int().min(1).max(100).describe(
        "Max people to return (1-100; the vendor default is 25). Billing " +
            "is per started block of 10 returned results.",
    ).optional(),
    filters: z.strictObject({
        title: z.string().optional(),
        company: z.string().optional(),
        location: z.string().optional(),
    }).describe("Optional structured narrowing filters.").optional(),
    contents: z.strictObject({
        fields: z.array(
            z.enum(["linkedin", "title", "company", "location", "name"]),
        ).optional(),
    }).describe("Which person fields to include on each result.").optional(),
});
