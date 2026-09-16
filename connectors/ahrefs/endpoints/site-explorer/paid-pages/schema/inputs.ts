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

/** The fixed `select` list — 13 API units per row (design D4). */
export const PAID_PAGES_FIELDS = [
    "url",
    "sum_traffic",
    "top_keyword",
    "ads_count",
] as const;

/** GET /site-explorer/paid-pages query (ported from v1). */
export const zPaidPagesQueryParams = z.object({
    target: zTarget,
    date: zDate,
    country: zCountry.optional(),
    mode: zMode.optional(),
    protocol: zProtocol.optional(),
    limit: zLimit.optional(),
    where: zWhere(PAID_PAGES_FIELDS).optional(),
    order_by: zOrderBy(PAID_PAGES_FIELDS).optional(),
}).strict();
