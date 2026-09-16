import { z } from "zod";

const SUGGEST_TYPES = [
    "lang",
    "site",
    "geo",
    "media",
    "content",
    "topic",
    "ent",
] as const;

/** `GET suggest.api.opoint.com/suggest/…` (as `/suggest`): the caller's
 *  query, translated into path segments by the doc's toRequest. Bounds
 *  are v1's pinned scope (the suggestion server documents none). */
export const zOpointSuggestQueryParams = z.strictObject({
    query: z.string().min(1).max(200).describe(
        "Name or URL to resolve, e.g. 'Norway', 'New York Post', 'bbc.co.uk'.",
    ),
    types: z.array(z.enum(SUGGEST_TYPES)).min(1).max(SUGGEST_TYPES.length)
        .describe("Restrict to these filter types; omitted = all types.")
        .optional(),
    limit: z.number().int().min(1).max(20).describe(
        "Rows to return (default 5).",
    ).optional(),
});
