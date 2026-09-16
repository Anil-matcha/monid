import { z } from "zod";
import {
    zLimit,
    zMode,
    zOrderBy,
    zProtocol,
    zTarget,
    zWhere,
} from "../../../../schema/common.ts";

/** The fixed `select` list — 10 API units per row (design D4). */
export const ALL_BACKLINKS_FIELDS = [
    "url_from",
    "url_to",
    "anchor",
    "title",
    "domain_rating_source",
    "url_rating_source",
    "first_seen",
    "last_seen",
    "is_dofollow",
    "link_type",
] as const;

/** GET /site-explorer/all-backlinks query (ported from v1). */
export const zAllBacklinksQueryParams = z.object({
    target: zTarget,
    mode: zMode.optional(),
    protocol: zProtocol.optional(),
    limit: zLimit.optional(),
    where: zWhere(ALL_BACKLINKS_FIELDS).optional(),
    order_by: zOrderBy(ALL_BACKLINKS_FIELDS).optional(),
}).strict();
