import { z } from "zod";
import {
    zCountry,
    zDateFrom,
    zDateTo,
    zHistoryGrouping,
    zMode,
    zProtocol,
    zTarget,
} from "../../../../schema/common.ts";

/** The fixed `select` list — 6 API units per row (design D4). */
export const KEYWORDS_HISTORY_FIELDS = [
    "date",
    "top3",
    "top4_10",
    "top11_20",
    "top21_50",
    "top51_plus",
] as const;

/** GET /site-explorer/keywords-history query (ported from v1). */
export const zKeywordsHistoryQueryParams = z.object({
    target: zTarget,
    date_from: zDateFrom,
    date_to: zDateTo.optional(),
    history_grouping: zHistoryGrouping.optional(),
    mode: zMode.optional(),
    protocol: zProtocol.optional(),
    country: zCountry.optional(),
}).strict();
