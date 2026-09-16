import { z } from "zod";
import {
    zCompanyDomainField,
    zCompanySocialProfileField,
} from "../../../../schema/common.ts";

/** Clay-managed "Job Openings" function inputs (upstream keys, verbatim). */
export const zCompanyJobOpeningsBody = z.object({
    "Company Domain": zCompanyDomainField,
    "Company Social Profile URL": zCompanySocialProfileField.optional(),
}).strict();
