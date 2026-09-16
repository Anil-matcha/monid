import { z } from "zod";
import { zCountry, zKeywords } from "../../../../schema/common.ts";

/** The fixed `select` list — 42 API units per row (design D4). */
export const OVERVIEW_FIELDS = [
    "keyword",
    "volume",
    "difficulty",
    "traffic_potential",
    "intents",
    "cpc",
] as const;

/** GET /keywords-explorer/overview query (ported from v1). */
export const zOverviewQueryParams = z.object({
    country: zCountry,
    keywords: zKeywords,
}).strict();
