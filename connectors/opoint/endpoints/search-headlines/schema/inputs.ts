import { z } from "zod";
import { zSearchParams, zSearchterm } from "../../../schema/common.ts";

/** `POST /search/` (as `/search-headlines`): the `/search` input, same
 *  allow-list — only the wire profile differs (no article text). */
export const zOpointSearchHeadlinesBody = z.strictObject({
    searchterm: zSearchterm,
    params: zSearchParams.describe(
        "Optional search parameters: page size, published-time window, " +
            "pagination cursor, ordering, and excluded ids.",
    ).optional(),
});
