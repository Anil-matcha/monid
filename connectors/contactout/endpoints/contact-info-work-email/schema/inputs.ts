import { z } from "zod";
import { contactInfoShape } from "../../../schema/contact-info.ts";

/** GET /v1/people/linkedin query under the WORK key (ported from v1):
 *  `email_type` keeps only this key's kind and `none`, the phone-only
 *  switch. Vendor defaults (`work`, include_phone false) live at the
 *  binding. */
export const zContactInfoQueryParams = z.object({
    ...contactInfoShape,
    email_type: z.enum(["work", "none"]).describe(
        "'work' (default) returns the work email addresses; 'none' " +
            "returns no emails (phone only, with include_phone).",
    ).optional(),
}).strict();
