import { z } from "zod";
import { peopleEnrichShape } from "../../../schema/people-enrich.ts";

/** POST /v1/people/enrich body under the WORK key (ported from v1): the
 *  shared identifier set plus this key's `include` vocabulary. */
export const zPeopleEnrichBody = z.object({
    ...peopleEnrichShape,
    include: z.array(z.enum(["work_email", "phone"])).describe(
        "Contact data to include — 'work_email' and/or 'phone', each " +
            "billing its unit when found. Omit for profile data only.",
    ).optional(),
}).strict();
