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
export const CRAWLED_PAGES_FIELDS = [
    "url",
    "title",
    "url_rating",
    "http_code",
    "first_seen",
    "last_crawled",
] as const;

/** GET /site-explorer/crawled-pages query (ported from v1). */
export const zCrawledPagesQueryParams = z.object({
    target: zTarget,
    mode: zMode.optional(),
    protocol: zProtocol.optional(),
    limit: zLimit.optional(),
    where: zWhere(CRAWLED_PAGES_FIELDS).optional(),
    order_by: zOrderBy(CRAWLED_PAGES_FIELDS, { single: true }).optional(),
}).strict();
