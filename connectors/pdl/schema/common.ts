import { z } from "zod";

/**
 * Shared fragments for the People Data Labs endpoint schemas (ported from
 * v1 endpoints/inputs.ts). Faithful vendor mirror: optionality only — the
 * one platform tightening (search `size` required) lives at the bindings
 * (design D25). The vendor-documented defaults (min_likelihood 2,
 * include_if_matched / titlecase / pretty false, size 1) are NOT
 * materialized: none feeds an estimate, so absent means PDL's own default.
 *
 * SINGLE-VALUE ONLY (design D7): PDL lets most enrichment parameters
 * repeat on the query string — `location=A&location=B`, several
 * `profile`s — and the engine's query serialization is scalar-only
 * (`toScalarQuery` rejects arrays: "array/object encodings arrive at a
 * later engine version"). Every field here is therefore a single value,
 * as v1's schemas were. This mirror does NOT widen to string-or-array:
 * a doc promising an array the engine refuses at dispatch is worse than
 * one that says what it supports. Raised on PR #7; the repeated-param
 * encoding is its own engine change.
 *
 * PORT NOTE: v1 guarded the enrichment identifier combinations ("one of
 * pdl_id | profile | email | phone | email_hash | lid, OR a name plus one
 * location-ish field") with `.superRefine()`. That cross-field rule cannot
 * be represented in the compiled JSON Schema (design D6); it is DOCUMENTED
 * in the schema describes and PDL answers 400 invalid_request_error
 * (error-as-data). The search `query` XOR `sql` rule, by contrast, DOES
 * survive: it is a union of two `.strict()` variants, so a body carrying
 * both fails every branch at input validation.
 */

/** Match-confidence floor, 1-10 (vendor default 2). */
export const zLikelihood = z.number().int().min(1).max(10).describe(
    "Minimum match likelihood (1-10). Default 2.",
);

/** Output-shaping knobs shared by the enrichment endpoints. */
export const enrichOutputFields = {
    required: z.string().optional().describe(
        "Fields the matched record must contain (e.g. 'emails AND " +
            "profiles').",
    ),
    data_include: z.string().optional().describe(
        "Comma-separated fields to include in the returned record.",
    ),
    include_if_matched: z.boolean().optional().describe(
        "Include a `matched` array listing which input fields matched. " +
            "Default false.",
    ),
    titlecase: z.boolean().optional().describe(
        "Titlecase the returned record. Default false.",
    ),
    pretty: z.boolean().optional().describe(
        "Pretty-print the response. Default false.",
    ),
};

/** Pagination + shaping knobs shared by both search variants. */
export const searchSharedFields = {
    size: z.number().int().min(1).max(100).optional().describe(
        "Records to return (1-100). Each returned record is one credit.",
    ),
    scroll_token: z.string().optional().describe(
        "Pagination token from a previous response's scroll_token.",
    ),
    titlecase: z.boolean().optional().describe(
        "Titlecase the returned records. Default false.",
    ),
    pretty: z.boolean().optional().describe(
        "Pretty-print the response. Default false.",
    ),
};

/** Elasticsearch (v7.7) query DSL — an opaque object PDL evaluates. */
export const zEsQuery = z.record(z.string(), z.any()).describe(
    "Elasticsearch v7.7 query object run directly against the dataset. " +
        "Provide EITHER query OR sql.",
);

/** SQL WHERE-clause form, e.g. `SELECT * FROM person WHERE ...`. */
export const zSqlQuery = z.string().min(1).describe(
    "SQL query of the form SELECT * FROM <dataset> WHERE ... . Provide " +
        "EITHER sql OR query.",
);
