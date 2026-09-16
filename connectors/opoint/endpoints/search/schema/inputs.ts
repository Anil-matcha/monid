import { z } from "zod";
import { zSearchParams, zSearchterm } from "../../../schema/common.ts";

/** `POST /search/` (as `/search`): one expression string plus the shared
 *  params allow-list. Strict — see schema/common.ts for why. */
export const zOpointSearchBody = z.strictObject({
    searchterm: zSearchterm,
    params: zSearchParams.describe(
        "Optional search parameters: page size, published-time window, " +
            "pagination cursor, ordering, and excluded ids.",
    ).optional(),
});
