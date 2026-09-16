import { z } from "zod";
import { zCountry, zDate, zKeyword } from "../../../../schema/common.ts";

/** The fixed `select` list — 20 API units per row (design D4). */
export const SERP_OVERVIEW_FIELDS = [
    "position",
    "url",
    "title",
    "url_rating",
    "backlinks",
    "refdomains",
    "traffic",
] as const;

/** GET /serp-overview/serp-overview query (ported from v1). */
export const zSerpOverviewQueryParams = z.object({
    keyword: zKeyword,
    country: zCountry,
    date: zDate.optional(),
    top_positions: z.number().int().min(1).max(100).describe(
        "How many top positions to return (1-100; one billed row per " +
            "position).",
    ).optional(),
}).strict();
