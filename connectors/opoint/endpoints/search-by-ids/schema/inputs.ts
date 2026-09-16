import { z } from "zod";
import { zArticleRef, zSearchParams } from "../../../schema/common.ts";

/** `POST /search/` (as `/search-by-ids`): no searchterm — the id list
 *  rides in `params.articles`, beside the shared params allow-list. */
export const zOpointSearchByIdsBody = z.strictObject({
    params: zSearchParams.extend({
        articles: z.array(zArticleRef).min(1).max(100).describe(
            "Site/article id pairs to fetch.",
        ),
    }).describe(
        "The id list plus the optional search parameters (page size is " +
            "sized to the list on the wire).",
    ),
});
