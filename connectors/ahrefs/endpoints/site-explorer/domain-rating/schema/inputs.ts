import { z } from "zod";
import { zDate, zTarget } from "../../../../schema/common.ts";

/** GET /site-explorer/domain-rating query (ported from v1). */
export const zDomainRatingQueryParams = z.object({
    target: zTarget,
    date: zDate,
}).strict();
