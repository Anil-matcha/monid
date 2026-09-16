import { z } from "zod";
import { contactInfoShape } from "../../../schema/contact-info.ts";

/** GET /v1/people/linkedin query under the PERSONAL key (ported from v1):
 *  `email_type` keeps only this key's kind and `none`, the phone-only
 *  switch. Vendor defaults (`personal`, include_phone false) live at the
 *  binding. */
export const zContactInfoQueryParams = z.object({
    ...contactInfoShape,
    email_type: z.enum(["personal", "none"]).describe(
        "'personal' (default) returns the personal email addresses; " +
            "'none' returns no emails (phone only, with include_phone).",
    ).optional(),
}).strict();
