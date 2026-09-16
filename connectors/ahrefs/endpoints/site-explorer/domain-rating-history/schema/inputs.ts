import { z } from "zod";
import {
    zDateFrom,
    zDateTo,
    zHistoryGrouping,
    zTarget,
} from "../../../../schema/common.ts";

/** GET /site-explorer/domain-rating-history query (ported from v1). */
export const zDomainRatingHistoryQueryParams = z.object({
    target: zTarget,
    date_from: zDateFrom,
    date_to: zDateTo.optional(),
    history_grouping: zHistoryGrouping.optional(),
}).strict();
