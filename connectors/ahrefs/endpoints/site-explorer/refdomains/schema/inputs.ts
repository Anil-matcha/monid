import { z } from "zod";
import {
    zLimit,
    zMode,
    zOrderBy,
    zProtocol,
    zTarget,
    zWhere,
} from "../../../../schema/common.ts";

/** The fixed `select` list — 6 API units per row (design D4). */
export const REFDOMAINS_FIELDS = [
    "domain",
    "domain_rating",
    "links_to_target",
    "dofollow_links",
    "first_seen",
    "last_seen",
] as const;

/** GET /site-explorer/refdomains query (ported from v1). */
export const zRefdomainsQueryParams = z.object({
    target: zTarget,
    mode: zMode.optional(),
    protocol: zProtocol.optional(),
    limit: zLimit.optional(),
    where: zWhere(REFDOMAINS_FIELDS).optional(),
    order_by: zOrderBy(REFDOMAINS_FIELDS).optional(),
}).strict();
