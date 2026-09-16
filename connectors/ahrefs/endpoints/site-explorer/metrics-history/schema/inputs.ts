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

/** The fixed `select` list — 21 API units per row (design D4). */
export const METRICS_HISTORY_FIELDS = [
    "date",
    "org_traffic",
    "paid_traffic",
] as const;

/** GET /site-explorer/metrics-history query (ported from v1). */
export const zMetricsHistoryQueryParams = z.object({
    target: zTarget,
    date_from: zDateFrom,
    date_to: zDateTo.optional(),
    history_grouping: zHistoryGrouping.optional(),
    mode: zMode.optional(),
    protocol: zProtocol.optional(),
    country: zCountry.optional(),
}).strict();
