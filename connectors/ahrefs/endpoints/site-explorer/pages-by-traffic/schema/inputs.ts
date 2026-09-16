import { z } from "zod";
import {
    zCountry,
    zMode,
    zProtocol,
    zTarget,
} from "../../../../schema/common.ts";

/** GET /site-explorer/pages-by-traffic query (ported from v1). */
export const zPagesByTrafficQueryParams = z.object({
    target: zTarget,
    mode: zMode.optional(),
    protocol: zProtocol.optional(),
    country: zCountry.optional(),
}).strict();
