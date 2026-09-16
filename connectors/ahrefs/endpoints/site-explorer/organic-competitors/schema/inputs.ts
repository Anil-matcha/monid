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

/** The fixed `select` list — 14 API units per row (design D4). */
export const ORGANIC_COMPETITORS_FIELDS = [
    "competitor_domain",
    "domain_rating",
    "keywords_common",
    "share",
    "traffic",
] as const;

/** GET /site-explorer/organic-competitors query (ported from v1). */
export const zOrganicCompetitorsQueryParams = z.object({
    target: zTarget,
    date: zDate,
    country: zCountry,
    mode: zMode.optional(),
    protocol: zProtocol.optional(),
    limit: zLimit.optional(),
    where: zWhere(ORGANIC_COMPETITORS_FIELDS).optional(),
    order_by: zOrderBy(ORGANIC_COMPETITORS_FIELDS).optional(),
}).strict();
