import { z } from "zod";

const zStringOrList = z.union([z.string().min(1), z.array(z.string().min(1))]);

/** `POST /v1/linkedin/search` — structured LinkedIn people search. Strict
 *  at every level: a typo inside `filters` must fail INVALID_INPUT, not
 *  run an unfiltered paid search. */
export const zPloidLinkedinSearchBody = z.strictObject({
    filters: z.strictObject({
        keywords: z.string().max(500).optional(),
        location: zStringOrList.optional(),
        title: zStringOrList.optional(),
        currentCompany: zStringOrList.optional(),
        school: zStringOrList.optional(),
    }).describe("Structured filters; each accepts one value or a list.")
        .optional(),
    limit: z.number().int().min(1).max(100).describe(
        "Max people to return (1-100; the vendor default is 25). Billing " +
            "is per started block of 10 returned matches.",
    ).optional(),
    cursor: z.string().min(1).describe(
        "Pagination cursor from a previous response's data.cursor.",
    ).optional(),
});
