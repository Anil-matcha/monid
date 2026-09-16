import { z } from "zod";
import { zOrgIdentifiers } from "../../../schema/common.ts";

/** GET /company/search query params — fuzzy name OR one identifier. */
export const zCompanySearchQueryParams = z.object({
    name: z.string().min(1).optional().describe(
        "Fuzzy company name search with relevance scoring.",
    ),
    domain: zOrgIdentifiers.domain,
    linkedin: zOrgIdentifiers.linkedin,
    crunchbase: zOrgIdentifiers.crunchbase,
}).strict().describe(
    "Provide EXACTLY ONE of name, domain, linkedin, crunchbase.",
);
