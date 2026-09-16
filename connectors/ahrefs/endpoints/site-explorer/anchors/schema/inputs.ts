import { z } from "zod";
import {
    zLimit,
    zMode,
    zOrderBy,
    zProtocol,
    zTarget,
    zWhere,
} from "../../../../schema/common.ts";

/** The fixed `select` list — 9 API units per row (design D4). */
export const ANCHORS_FIELDS = [
    "anchor",
    "refdomains",
    "links_to_target",
    "first_seen",
    "last_seen",
] as const;

/** GET /site-explorer/anchors query (ported from v1). */
export const zAnchorsQueryParams = z.object({
    target: zTarget,
    mode: zMode.optional(),
    protocol: zProtocol.optional(),
    limit: zLimit.optional(),
    where: zWhere(ANCHORS_FIELDS).optional(),
    order_by: zOrderBy(ANCHORS_FIELDS).optional(),
}).strict();
