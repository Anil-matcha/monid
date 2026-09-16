import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zEmailToLinkedinQueryParams } from "./schema/inputs.ts";

/**
 * GET /v1/people/person — one email address in, its LinkedIn profile URL
 * out. Bills ONE email credit of the CALLING key on a hit (measured), so
 * it rides the cheaper work key; a miss answers 404 (zero-billed as
 * error-as-data). Flat per hit ⇒ PER_CALL, quantities fns synthesized.
 */
export default defineEndpoint({
    meta: {
        displayName: "LinkedIn URL from Email",
        summary:
            "Resolve an email address to its LinkedIn profile URL; bills one work email credit.",
        description: "The minimal email-to-identity hop: one email address " +
            "(work or personal) in, the matching LinkedIn profile URL out " +
            "— nothing else. An unknown address answers 404 and costs " +
            "nothing. Suited for de-anonymizing signups and routing an " +
            "email to its owner's profile before a fuller enrichment; " +
            "chain onward by passing the returned URL to LinkedIn Full " +
            "Profile + Contacts.",
        docsUrl: "https://api.contactout.com/#email-to-linkedin-api",
        categories: ["people-enrichment"],
        notes: [
            "One work email credit per hit, whatever kind of address was " +
            "given. A 404 miss costs nothing.",
        ],
    },
    request: { method: "GET", path: "/v1/people/person" },
    /** Sends the WORK key (design D1): the provider holds both keys, the
     *  endpoint says which one rides the `token` header. */
    auth: {
        inject: ({ data }) => ({
            ...data.request,
            headers: { ...data.request.headers, token: data.params.workApiKey },
        }),
    },
    input: { schema: { queryParams: zEmailToLinkedinQueryParams } },
    usage: {
        /** v1 makePerCallPrice(rates.workEmail): one email credit per
         *  successful call, from the work pool. */
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "resolved emails",
            consumes: { credit: "email_work", amount: 1 },
        },
    },
});
