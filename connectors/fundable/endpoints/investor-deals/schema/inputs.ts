import { z } from "zod";
import {
    EXACTLY_ONE_ORG,
    zOrgIdentifiers,
    zPagination,
} from "../../../schema/common.ts";

/** GET /investor/deals query params — one identifier + pagination. */
export const zInvestorDealsQueryParams = z.object({
    ...zOrgIdentifiers,
    ...zPagination,
}).strict().describe(EXACTLY_ONE_ORG);
