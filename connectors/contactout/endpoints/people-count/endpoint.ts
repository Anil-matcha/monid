import { defineEndpoint, UsageModelKind } from "@shared/core";
import { SEARCH_EXCLUSION_NOTES } from "../../schema/people-search.ts";
import { zPeopleCountBody } from "./schema/inputs.ts";

/**
 * POST /v1/people/count — the free sizing probe for a people search
 * (paid-plan gated upstream, 0 credits — drill-verified). Work key.
 */
export default defineEndpoint({
    meta: {
        displayName: "Count Matching Profiles",
        summary:
            "Count profiles matching search filters, with contact-coverage estimates; free.",
        description: "Free sizing probe for a people search: takes the same " +
            "filter set (title, company, skills, location, industry, and " +
            "the rest) and returns total_results plus " +
            "estimated_personal_emails, estimated_work_emails, and " +
            "estimated_phones. Suited for checking whether a filter " +
            "combination is worth paying to page through, and for tuning " +
            "filters before the paid search (work-email or personal-email " +
            "variant of Search People).",
        docsUrl: "https://api.contactout.com/#people-count-api",
        categories: ["people-enrichment"],
        notes: SEARCH_EXCLUSION_NOTES,
    },
    request: { method: "POST", path: "/v1/people/count" },
    /** Sends the WORK key (design D1): the provider holds both keys, the
     *  endpoint says which one rides the `token` header. */
    auth: {
        inject: ({ data }) => ({
            ...data.request,
            headers: { ...data.request.headers, token: data.params.workApiKey },
        }),
    },
    input: { schema: { body: zPeopleCountBody } },
    usage: {
        /** FREE (D25): v1 makePerCallPrice(0) — "USD 0 wins verbatim". The
         *  quantities fns are compiler-synthesized. */
        model: { kind: UsageModelKind.FREE },
    },
});
