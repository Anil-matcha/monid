import { z } from "zod";
import {
    EXACTLY_ONE_PERSON,
    zPersonIdentifiers,
} from "../../../schema/common.ts";

/** GET /person query params — exactly one identifier (documented rule,
 *  design D6). */
export const zPersonQueryParams = z.object(zPersonIdentifiers).strict()
    .describe(EXACTLY_ONE_PERSON);
