import { z } from "zod";
import {
    zLimit,
    zMode,
    zOrderBy,
    zProtocol,
    zTarget,
    zWhere,
} from "../../../../schema/common.ts";

/** The fixed `select` list — 8 API units per row (design D4). */
export const PAGES_BY_BACKLINKS_FIELDS = [
    "url_to",
    "title_target",
    "links_to_target",
    "refdomains_target",
] as const;

/** `title_target` is selectable but NOT sortable upstream (drill-measured). */
export const PAGES_BY_BACKLINKS_FIELDS_SORTABLE = PAGES_BY_BACKLINKS_FIELDS
    .filter(
        (field) => !["title_target"].includes(field),
    );

/** GET /site-explorer/pages-by-backlinks query (ported from v1). */
export const zPagesByBacklinksQueryParams = z.object({
    target: zTarget,
    mode: zMode.optional(),
    protocol: zProtocol.optional(),
    limit: zLimit.optional(),
    where: zWhere(PAGES_BY_BACKLINKS_FIELDS).optional(),
    order_by: zOrderBy(PAGES_BY_BACKLINKS_FIELDS, {
        sortable: PAGES_BY_BACKLINKS_FIELDS_SORTABLE,
    }).optional(),
}).strict();
