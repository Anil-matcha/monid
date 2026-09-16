import { z } from "zod";
import { zSearchParams, zSearchterm } from "../../../schema/common.ts";

const zFilterType = z.enum([
    "lang",
    "geo",
    "site",
    "media",
    "content",
    "subject",
    "ent",
    "topic",
    "url",
    "domain",
]);

const zFilterItem = z.strictObject({
    type: zFilterType.describe("Filter type, as returned by /suggest."),
    id: z.union([z.string(), z.number().int()]).describe(
        "Filter id from /suggest (geo: 1203) or a literal (lang: 'en', " +
            "url: 'bbc.co.uk').",
    ),
});

const zExpression = z.strictObject({
    linemode: z.enum(["R", "O", "E"]).describe(
        "R = required, O = optional, E = exclude this line.",
    ),
    searchline: z.strictObject({
        searchterm: zSearchterm,
        filters: z.array(zFilterItem).max(20).describe(
            "Structured filters ANDed onto the searchterm.",
        ).optional(),
    }),
});

/** `POST /search/` (as `/search-advanced`): structured expression lines
 *  with typed filters plus the shared params allow-list. */
export const zOpointSearchAdvancedBody = z.strictObject({
    expressions: z.array(zExpression).min(1).max(10).describe(
        "One or more search lines; R lines must all match.",
    ),
    params: zSearchParams.describe(
        "Optional search parameters: page size, published-time window, " +
            "pagination cursor, ordering, and excluded ids.",
    ).optional(),
});
