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

/** GET /site-explorer/total-search-volume-history query (ported from v1). */
export const zTotalSearchVolumeHistoryQueryParams = z.object({
    target: zTarget,
    date_from: zDateFrom,
    date_to: zDateTo.optional(),
    history_grouping: zHistoryGrouping.optional(),
    mode: zMode.optional(),
    protocol: zProtocol.optional(),
    country: zCountry.optional(),
}).strict();
