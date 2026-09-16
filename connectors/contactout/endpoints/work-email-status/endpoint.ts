import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zProfileQueryParams } from "../../schema/common.ts";

/**
 * GET /v1/people/linkedin/work_email_status — free availability flag
 * (paid-plan gated upstream, 0 credits — drill-verified). Work key.
 */
export default defineEndpoint({
    meta: {
        displayName: "Check Work Email Availability",
        summary:
            "Check for free whether a work email exists for a LinkedIn profile.",
        description: "Free availability flag: one LinkedIn profile URL in, a " +
            "boolean out — whether a work email address is on file, plus " +
            "its Verified/Unverified status. No address is returned and " +
            "nothing is billed. Suited as the zero-cost pre-check before " +
            "paying for the work-email reveal (LinkedIn Contacts Only, " +
            "work email).",
        docsUrl: "https://api.contactout.com/#work-email-checker",
        categories: ["people-enrichment"],
    },
    request: { method: "GET", path: "/v1/people/linkedin/work_email_status" },
    /** Sends the WORK key (design D1): the provider holds both keys, the
     *  endpoint says which one rides the `token` header. */
    auth: {
        inject: ({ data }) => ({
            ...data.request,
            headers: { ...data.request.headers, token: data.params.workApiKey },
        }),
    },
    input: { schema: { queryParams: zProfileQueryParams } },
    usage: { model: { kind: UsageModelKind.FREE } },
});
