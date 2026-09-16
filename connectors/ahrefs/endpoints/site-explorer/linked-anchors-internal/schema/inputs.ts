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
export const LINKED_ANCHORS_INTERNAL_FIELDS = [
    "anchor",
    "links_from_target",
    "linked_pages",
    "first_seen",
] as const;

/** GET /site-explorer/linked-anchors-internal query (ported from v1). */
export const zLinkedAnchorsInternalQueryParams = z.object({
    target: zTarget,
    mode: zMode.optional(),
    protocol: zProtocol.optional(),
    limit: zLimit.optional(),
    where: zWhere(LINKED_ANCHORS_INTERNAL_FIELDS).optional(),
    order_by: zOrderBy(LINKED_ANCHORS_INTERNAL_FIELDS).optional(),
}).strict();
