import { z } from "zod";

/** `GET /v1/linkedin/companies/posts` — a company page's recent posts.
 *  v1's "company, companyId, or companyUniversalName" refinement is
 *  documentation here (D6). */
export const zPloidLinkedinCompanyPostsQueryParams = z.strictObject({
    company: z.string().min(1).describe("LinkedIn company URL or name.")
        .optional(),
    companyId: z.string().min(1).describe(
        "The company's socialId from a previous read.",
    ).optional(),
    companyUniversalName: z.string().min(1).describe(
        "The company's LinkedIn universal name (URL slug).",
    ).optional(),
    postedLimit: z.string().min(1).describe(
        "Recency window for the posts, e.g. '1 month'.",
    ).optional(),
    scrapePostedLimit: z.string().min(1).optional(),
    page: z.string().min(1).optional(),
    paginationToken: z.string().min(1).describe(
        "Continuation token from a previous response.",
    ).optional(),
}).describe("Provide company, companyId, or companyUniversalName.");
