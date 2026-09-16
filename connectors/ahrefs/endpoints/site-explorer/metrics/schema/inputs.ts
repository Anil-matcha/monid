import { z } from "zod";
import {
    zCountry,
    zDate,
    zMode,
    zProtocol,
    zTarget,
} from "../../../../schema/common.ts";

/** GET /site-explorer/metrics query (ported from v1). */
export const zMetricsQueryParams = z.object({
    target: zTarget,
    date: zDate,
    country: zCountry.optional(),
    mode: zMode.optional(),
    protocol: zProtocol.optional(),
}).strict();
