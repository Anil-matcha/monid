import { z } from "zod";

/**
 * Shared fragments for the People Data Labs endpoint schemas (ported from
 * v1 endpoints/inputs.ts). Faithful vendor mirror: optionality only — the
 * one platform tightening (search `size` required) lives at the bindings
 * (design D25). The vendor-documented defaults (min_likelihood 2,
 * include_if_matched / titlecase / pretty false, size 1) are NOT
 * materialized: none feeds an estimate, so absent means PDL's own default.
 *
 * MULTI-VALUE MATCHING (design D7): PDL widens a match by REPEATING a
 * parameter — "append the parameter with values as many times as needed".
 * Every REPEATABLE matching field is therefore `zPdlMatch` below: a LIST,
 * always, which the engine sends as `?k=a&k=b`. The exceptions stay plain
 * scalars — `locality`, `region`, `country` and `street_address` (company
 * enrichment adds `postal_code`), which the vendor caps at one value
 * ("linearly related; multiple inputs would make it impossible to
 * match"), as do the output-shaping knobs below. Raised on PR #7 and
 * answered by the repeated-query-params engine change.
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

/**
 * A PDL MATCHING parameter: a LIST, always — one element for one value.
 *
 * Not `string | string[]` (a caller should never pick between two shapes)
 * and not a comma-separated string: a comma is legal INSIDE a PDL value —
 * its own documented example location is "1600 Amphitheatre Pkwy,
 * Mountain View, CA 94043" — so splitting one would be guesswork, which
 * is exactly why PDL repeats the key instead. PDL's own JSON examples are
 * written this way too (`"name": ["Sean Thorne"]`).
 */
export const zPdlMatch = (describe: string) =>
    z.array(z.string().min(1)).min(1).optional().describe(
        `${describe} A list — one value, or several to widen the match.`,
    );

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
