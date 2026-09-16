import { z } from "zod";
import {
    zCompanyDomainField,
    zCompanyNameField,
    zCompanySocialProfileField,
} from "../../../../schema/common.ts";

/** Clay-managed "Industry" function inputs (upstream keys, verbatim). */
export const zCompanyIndustryBody = z.object({
    "Company Domain": zCompanyDomainField,
    "Company Name": zCompanyNameField.optional(),
    "Company Social Profile URL": zCompanySocialProfileField.optional(),
}).strict();
