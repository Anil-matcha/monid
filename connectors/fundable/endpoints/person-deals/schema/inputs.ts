import { z } from "zod";
import {
    EXACTLY_ONE_PERSON,
    zPagination,
    zPersonIdentifiers,
} from "../../../schema/common.ts";

/** GET /person/deals query params — one identifier + pagination. */
export const zPersonDealsQueryParams = z.object({
    ...zPersonIdentifiers,
    ...zPagination,
}).strict().describe(EXACTLY_ONE_PERSON);
