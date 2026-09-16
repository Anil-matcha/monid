import { z } from "zod";
import {
    zCountry,
    zDateFrom,
    zDateTo,
    zKeyword,
} from "../../../../schema/common.ts";

/** GET /keywords-explorer/volume-history query (ported from v1). */
export const zVolumeHistoryQueryParams = z.object({
    keyword: zKeyword,
    country: zCountry,
    date_from: zDateFrom,
    date_to: zDateTo.optional(),
}).strict();
