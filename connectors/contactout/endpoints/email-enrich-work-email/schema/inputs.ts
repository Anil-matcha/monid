import { z } from "zod";
import { zEmail } from "../../../schema/common.ts";

/** GET /v1/email/enrich query under the WORK key (ported from v1). The
 *  work variant alone may ask for a real-time verification of the work
 *  address; the personal key has no such switch. */
export const zEmailEnrichQueryParams = z.object({
    email: zEmail.describe("The email address to look up."),
    include: z.enum(["work_email"]).describe(
        "Pass 'work_email' to also real-time-verify the returned work " +
            "address (adds workEmailStatus).",
    ).optional(),
}).strict();
