import { z } from "zod";

/** Clay-managed "Company Domain" function inputs (upstream keys, verbatim). */
export const zCompanyDomainBody = z.object({
    "Company Name": z.string().min(1).describe(
        "The company name to resolve, e.g. 'Anthropic'.",
    ),
}).strict();
