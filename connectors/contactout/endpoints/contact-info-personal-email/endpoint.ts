import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zContactInfoQueryParams } from "./schema/inputs.ts";

/**
 * GET /v1/people/linkedin under the PERSONAL key — contacts only, no
 * profile body. The work-email twin is `contact-info-work-email`; billing
 * and counting are that file's, on the personal pools. Personal key on the
 * header (design D1).
 */
export default defineEndpoint({
    meta: {
        displayName: "LinkedIn Contacts Only (Personal Email)",
        summary:
            "Contacts only, no profile body, from a LinkedIn URL; bills personal email credits.",
        description: "Contacts-only lookup for a single LinkedIn profile " +
            "(for the profile body too, use the LinkedIn Full Profile + " +
            "Contacts endpoint) — this variant returns personal email " +
            "addresses only (work email is a separate endpoint). Returns " +
            "the addresses, phone numbers (with include_phone), and GitHub " +
            "usernames — no profile body, so it is the light, cheap " +
            "alternative to full enrichment. Set email_type=none for a " +
            "phone-only lookup. A profile with no personal email on file " +
            "answers 404 and costs nothing. Suited for reveal steps after " +
            "a search and for refreshing stored contact records.",
        docsUrl: "https://api.contactout.com/#contact-info-api-single",
        categories: ["people-enrichment"],
        notes: [
            "Billed per profile: a found personal email draws one email " +
            "credit (however many addresses); with include_phone, a found " +
            "phone number draws one phone credit. A 404 miss costs nothing.",
        ],
    },
    endpoint: "/v1/people/linkedin/personal-email",
    request: { method: "GET", path: "/v1/people/linkedin" },
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
    input: { schema: { queryParams: zContactInfoQueryParams } },
    usage: {
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                email_found: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "personal emails found",
                    description:
                        "profiles that returned a personal email address (however many)",
                    consumes: { credit: "email_personal", amount: 1 },
                },
                phone_found: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "phone numbers found",
                    description: "profiles that returned a phone number",
                    consumes: { credit: "phone_personal", amount: 1 },
                },
            },
        },
        estimate: ({ data }) => ({
            counts: {
                email_found: data.input.queryParams.email_type === "none"
                    ? 0
                    : 1,
                phone_found: data.input.queryParams.include_phone === true
                    ? 1
                    : 0,
            },
        }),
        evidence: ({ data, utils }) => {
            const profile = utils.json.optionalGet(data.output, "$.profile");
            if (
                profile === undefined || profile === null ||
                typeof profile !== "object" || Array.isArray(profile)
            ) {
                return { counts: { email_found: 0, phone_found: 0 } };
            }
            const filled = (value: unknown): boolean =>
                Array.isArray(value)
                    ? value.length > 0
                    : typeof value === "string" && value.trim() !== "";
            const email = filled(profile.email) || filled(profile.work_email) ||
                    filled(profile.personal_email) || filled(profile.workEmail)
                ? 1
                : 0;
            return {
                counts: {
                    email_found: email,
                    phone_found: filled(profile.phone) ? 1 : 0,
                },
            };
        },
    },
});
