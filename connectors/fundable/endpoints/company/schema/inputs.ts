import { z } from "zod";
import { EXACTLY_ONE_ORG, zOrgIdentifiers } from "../../../schema/common.ts";

/** GET /company query params — exactly one identifier (documented rule,
 *  design D6). */
export const zCompanyQueryParams = z.object(zOrgIdentifiers).strict()
    .describe(EXACTLY_ONE_ORG);
