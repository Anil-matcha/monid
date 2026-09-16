import { z } from "zod";
import { EXACTLY_ONE_ORG, zOrgIdentifiers } from "../../../schema/common.ts";

/** GET /investor query params — exactly one identifier (documented rule,
 *  design D6). */
export const zInvestorQueryParams = z.object(zOrgIdentifiers).strict()
    .describe(EXACTLY_ONE_ORG);
