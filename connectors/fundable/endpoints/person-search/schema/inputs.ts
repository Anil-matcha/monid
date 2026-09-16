import { z } from "zod";
import { zPersonIdentifiers } from "../../../schema/common.ts";

/** GET /person/search query params — fuzzy name OR one identifier, with an
 *  optional pool restriction. */
export const zPersonSearchQueryParams = z.object({
    name: z.string().min(1).optional().describe(
        "Fuzzy person name search across investors and non-investor people " +
            "(founders, employees); up to 10 results.",
    ),
    ...zPersonIdentifiers,
    person_type: z.enum(["investor", "company"]).optional().describe(
        "Restrict to one pool: 'investor' (tracked investors/angels) or " +
            "'company' (founders, CEOs, employees). Omit to search both.",
    ),
}).strict().describe(
    "Provide EXACTLY ONE of name, id, linkedin, crunchbase, twitter.",
);
