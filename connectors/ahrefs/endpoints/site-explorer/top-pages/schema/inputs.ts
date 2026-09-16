import { z } from "zod";
import {
    zCountry,
    zDate,
    zLimit,
    zMode,
    zOrderBy,
    zProtocol,
    zTarget,
    zWhere,
} from "../../../../schema/common.ts";

/** The fixed `select` list — 23 API units per row (design D4). */
export const TOP_PAGES_FIELDS = [
    "url",
    "sum_traffic",
    "top_keyword",
    "top_keyword_volume",
    "top_keyword_best_position",
] as const;

/** GET /site-explorer/top-pages query (ported from v1). */
export const zTopPagesQueryParams = z.object({
    target: zTarget,
    date: zDate,
    country: zCountry.optional(),
    mode: zMode.optional(),
    protocol: zProtocol.optional(),
    limit: zLimit.optional(),
    where: zWhere(TOP_PAGES_FIELDS).optional(),
    order_by: zOrderBy(TOP_PAGES_FIELDS).optional(),
}).strict();
