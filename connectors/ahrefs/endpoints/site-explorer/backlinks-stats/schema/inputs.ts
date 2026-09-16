import { z } from "zod";
import { zDate, zMode, zProtocol, zTarget } from "../../../../schema/common.ts";

/** GET /site-explorer/backlinks-stats query (ported from v1). */
export const zBacklinksStatsQueryParams = z.object({
    target: zTarget,
    date: zDate,
    mode: zMode.optional(),
    protocol: zProtocol.optional(),
}).strict();
