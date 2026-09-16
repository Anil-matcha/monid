import { z } from "zod";
import { zMode, zProtocol, zTarget } from "../../../../schema/common.ts";

/** GET /site-explorer/outlinks-stats query (ported from v1). */
export const zOutlinksStatsQueryParams = z.object({
    target: zTarget,
    mode: zMode.optional(),
    protocol: zProtocol.optional(),
}).strict();
