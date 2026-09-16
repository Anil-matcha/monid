import { z } from "zod";
import { zEmail } from "../../../schema/common.ts";

/** GET /v1/email/enrich query under the PERSONAL key (ported from v1).
 *  No `include`: the real-time verification switch exists for work
 *  addresses only. */
export const zEmailEnrichQueryParams = z.object({
    email: zEmail.describe("The email address to look up."),
}).strict();
