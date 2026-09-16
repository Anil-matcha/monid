import { z } from "zod";
import {
    zDateFrom,
    zDateTo,
    zHistoryGrouping,
    zMode,
    zProtocol,
    zTarget,
} from "../../../../schema/common.ts";

/** GET /site-explorer/refdomains-history query (ported from v1). */
export const zRefdomainsHistoryQueryParams = z.object({
    target: zTarget,
    date_from: zDateFrom,
    date_to: zDateTo.optional(),
    history_grouping: zHistoryGrouping.optional(),
    mode: zMode.optional(),
    protocol: zProtocol.optional(),
}).strict();
