import { z } from "zod";
import {
    peopleSearchFilterShape,
    peopleSearchPageShape,
} from "../../../schema/people-search.ts";

/** POST /v1/people/search body under the WORK key (ported from v1): the
 *  shared filter + paging shapes plus this key's contact vocabulary.
 *  `page_size` is optional here (vendor default 25) and REQUIRED at the
 *  binding — it is the estimate's whole basis. */
export const zPeopleSearchBody = z.object({
    ...peopleSearchFilterShape,
    ...peopleSearchPageShape,
    data_types: z.array(z.enum(["work_email", "phone"])).describe(
        "Only return profiles having at least one of these contact kinds.",
    ).optional(),
    reveal_info: z.boolean().describe(
        "If true, contact_info carries the actual work email addresses " +
            "and phone numbers and the email/phone units bill per profile " +
            "where found. Default false (availability flags only).",
    ).optional(),
}).strict();
