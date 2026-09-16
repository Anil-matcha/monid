import { z } from "zod";
import { zSearchId, zSearchLimit } from "../../../../schema/common.ts";

/** POST /search/query-mode/{search_id}/run path params. */
export const zSearchRunPathParams = z.object({ search_id: zSearchId })
    .strict();

/** POST /search/query-mode/{search_id}/run body — faithful vendor mirror:
 *  `limit` is optional upstream (server default 20). The binding REQUIRES
 *  it (design D25 — the caller states the cap of a row-billed page). */
export const zSearchRunBody = z.object({
    limit: zSearchLimit.optional(),
}).strict();
