import { z } from "zod";
import {
    zCountry,
    zKeywords,
    zLimit,
    zOrderBy,
    zWhere,
} from "../../../../schema/common.ts";

/** The fixed `select` list — 22 API units per row (design D4). */
export const MATCHING_TERMS_FIELDS = [
    "keyword",
    "volume",
    "difficulty",
    "cpc",
] as const;

/** GET /keywords-explorer/matching-terms query (ported from v1). */
export const zMatchingTermsQueryParams = z.object({
    country: zCountry,
    keywords: zKeywords,
    limit: zLimit.optional(),
    where: zWhere(MATCHING_TERMS_FIELDS).optional(),
    order_by: zOrderBy(MATCHING_TERMS_FIELDS).optional(),
}).strict();
