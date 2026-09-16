import { z } from "zod";
import {
    zCompanyDomainField,
    zCompanyNameField,
    zCompanySocialProfileField,
    zFullNameField,
    zPersonalEmailField,
    zPersonSocialProfileField,
} from "../../../../schema/common.ts";

/** Clay-managed "Work Email" function inputs (upstream keys, verbatim). */
export const zWorkEmailBody = z.object({
    "Full Name": zFullNameField,
    "Company Domain": zCompanyDomainField,
    // person-side reading of the shared fragment (v1 wording)
    "Company Name": zCompanyNameField.describe(
        "The name of the company the person works at, e.g. 'Clay'.",
    ),
    "Company Social Profile URL": zCompanySocialProfileField.describe(
        "The company's LinkedIn page URL (optional disambiguation aid).",
    ).optional(),
    "Social Profile URL": zPersonSocialProfileField.optional(),
    "Personal Email": zPersonalEmailField.optional(),
}).strict();
