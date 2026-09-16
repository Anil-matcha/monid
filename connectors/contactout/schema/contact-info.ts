import { z } from "zod";
import { zLinkedInProfileUrl } from "./common.ts";

/**
 * The `GET /v1/people/linkedin` query, minus `email_type` — shared by the
 * work and personal contacts-only lookups, which differ only in the
 * `email_type` vocabulary (their own kind, or `none`). Ported from v1
 * `endpoints/contact-info.ts`.
 */
export const contactInfoShape = {
    profile: zLinkedInProfileUrl,
    include_phone: z.boolean().describe(
        "If true, also returns phone numbers and bills the phone unit " +
            "when one is found. Default false.",
    ).optional(),
} as const;
