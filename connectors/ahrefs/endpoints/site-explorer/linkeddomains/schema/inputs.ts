import { z } from "zod";
import {
    zLimit,
    zMode,
    zOrderBy,
    zProtocol,
    zTarget,
    zWhere,
} from "../../../../schema/common.ts";

/** The fixed `select` list — 4 API units per row (design D4). */
export const LINKEDDOMAINS_FIELDS = [
    "domain",
    "domain_rating",
    "links_from_target",
    "linked_pages",
] as const;

/** GET /site-explorer/linkeddomains query (ported from v1). */
export const zLinkeddomainsQueryParams = z.object({
    target: zTarget,
    mode: zMode.optional(),
    protocol: zProtocol.optional(),
    limit: zLimit.optional(),
    where: zWhere(LINKEDDOMAINS_FIELDS).optional(),
    order_by: zOrderBy(LINKEDDOMAINS_FIELDS).optional(),
}).strict();
