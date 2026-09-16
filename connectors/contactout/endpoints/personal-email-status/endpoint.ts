import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zProfileQueryParams } from "../../schema/common.ts";

/**
 * GET /v1/people/linkedin/personal_email_status — free availability flag
 * (paid-plan gated upstream, 0 credits — drill-verified). Rides the
 * PERSONAL key like v1 (the flags answer identically under either key;
 * the key choice keeps the checker beside the reveal it precedes).
 */
export default defineEndpoint({
    meta: {
        displayName: "Check Personal Email Availability",
        summary:
            "Check for free whether a personal email exists for a LinkedIn profile.",
        description: "Free availability flag: one LinkedIn profile URL in, a " +
            "boolean out — whether a personal email address is on file. No " +
            "address is returned and nothing is billed. Suited as the " +
            "zero-cost pre-check before paying for the personal-email " +
            "reveal (LinkedIn Contacts Only, personal email).",
        docsUrl: "https://api.contactout.com/#personal-email-checker",
        categories: ["people-enrichment"],
    },
    request: {
        method: "GET",
        path: "/v1/people/linkedin/personal_email_status",
    },
    /** Sends the PERSONAL key (design D1): the provider holds both keys,
     *  the endpoint says which one rides the `token` header. */
    auth: {
        inject: ({ data }) => ({
            ...data.request,
            headers: {
                ...data.request.headers,
                token: data.params.personalApiKey,
            },
        }),
    },
    input: { schema: { queryParams: zProfileQueryParams } },
    usage: { model: { kind: UsageModelKind.FREE } },
});
