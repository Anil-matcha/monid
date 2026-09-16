import { z } from "zod";
import {
    EXACTLY_ONE_ORG,
    zOrgIdentifiers,
    zPagination,
} from "../../../schema/common.ts";

/** GET /company/deals query params — one identifier + pagination. */
export const zCompanyDealsQueryParams = z.object({
    ...zOrgIdentifiers,
    ...zPagination,
}).strict().describe(EXACTLY_ONE_ORG);
