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

/** The fixed `select` list — 24 API units per row (design D4). */
export const ORGANIC_KEYWORDS_FIELDS = [
    "keyword",
    "best_position",
    "best_position_url",
    "volume",
    "sum_traffic",
    "cpc",
] as const;

/** GET /site-explorer/organic-keywords query (ported from v1). */
export const zOrganicKeywordsQueryParams = z.object({
    target: zTarget,
    date: zDate,
    country: zCountry.optional(),
    mode: zMode.optional(),
    protocol: zProtocol.optional(),
    limit: zLimit.optional(),
    where: zWhere(ORGANIC_KEYWORDS_FIELDS).optional(),
    order_by: zOrderBy(ORGANIC_KEYWORDS_FIELDS).optional(),
}).strict();
