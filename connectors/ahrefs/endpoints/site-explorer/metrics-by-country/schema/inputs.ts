import { z } from "zod";
import { zDate, zMode, zProtocol, zTarget } from "../../../../schema/common.ts";

/** The fixed `select` list — 23 API units per row (design D4). */
export const METRICS_BY_COUNTRY_FIELDS = [
    "country",
    "org_keywords",
    "org_traffic",
    "paid_keywords",
    "paid_traffic",
] as const;

/** GET /site-explorer/metrics-by-country query (ported from v1). */
export const zMetricsByCountryQueryParams = z.object({
    target: zTarget,
    date: zDate,
    mode: zMode.optional(),
    protocol: zProtocol.optional(),
}).strict();
