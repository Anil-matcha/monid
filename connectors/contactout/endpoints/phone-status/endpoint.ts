import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zProfileQueryParams } from "../../schema/common.ts";

/**
 * GET /v1/people/linkedin/phone_status — free availability flag
 * (paid-plan gated upstream, 0 credits — drill-verified). Work key.
 */
export default defineEndpoint({
    meta: {
        displayName: "Check Phone Availability",
        summary:
            "Check for free whether a phone number exists for a LinkedIn profile.",
        description: "Free availability flag: one LinkedIn profile URL in, a " +
            "boolean out — whether a phone number is on file. No number is " +
            "returned and nothing is billed. Suited as the zero-cost " +
            "pre-check before paying for a phone reveal via LinkedIn " +
            "Contacts Only with include_phone.",
        docsUrl: "https://api.contactout.com/#phone-number-checker",
        categories: ["people-enrichment"],
    },
    request: { method: "GET", path: "/v1/people/linkedin/phone_status" },
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
