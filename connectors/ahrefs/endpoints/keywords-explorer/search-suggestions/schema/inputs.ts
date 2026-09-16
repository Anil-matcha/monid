import { z } from "zod";
import {
    zCountry,
    zKeywords,
    zLimit,
    zOrderBy,
    zWhere,
} from "../../../../schema/common.ts";

/** The fixed `select` list — 12 API units per row (design D4). */
export const SEARCH_SUGGESTIONS_FIELDS = [
    "keyword",
    "volume",
    "cpc",
] as const;

/** GET /keywords-explorer/search-suggestions query (ported from v1). */
export const zSearchSuggestionsQueryParams = z.object({
    country: zCountry,
    keywords: zKeywords,
    limit: zLimit.optional(),
    where: zWhere(SEARCH_SUGGESTIONS_FIELDS).optional(),
    order_by: zOrderBy(SEARCH_SUGGESTIONS_FIELDS).optional(),
}).strict();
