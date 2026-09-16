import { z } from "zod";
import {
    zCompanyDomainField,
    zCompanyNameField,
    zFullNameField,
    zPersonalEmailField,
    zPersonSocialProfileField,
    zWorkEmailField,
} from "../../../../schema/common.ts";

/** Clay-managed "Mobile Phone" function inputs (upstream keys, verbatim). */
export const zMobilePhoneBody = z.object({
    "Social Profile URL": zPersonSocialProfileField,
    "Full Name": zFullNameField,
    // person-side reading of the shared fragment (v1 wording)
    "Company Name": zCompanyNameField.describe(
        "The name of the company the person works at, e.g. 'Clay'.",
    ),
    "Company Domain": zCompanyDomainField.optional(),
    "Work Email": zWorkEmailField.optional(),
    "Personal Email": zPersonalEmailField.optional(),
}).strict();
