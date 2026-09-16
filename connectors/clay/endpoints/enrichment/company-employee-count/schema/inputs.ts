import { z } from "zod";
import {
    zCompanyDomainField,
    zCompanyNameField,
    zCompanySocialProfileField,
} from "../../../../schema/common.ts";

/** Clay-managed "Employee Count" function inputs (upstream keys, verbatim). */
export const zCompanyEmployeeCountBody = z.object({
    "Company Domain": zCompanyDomainField,
    "Company Name": zCompanyNameField.optional(),
    "Company Social Profile URL": zCompanySocialProfileField.optional(),
}).strict();
