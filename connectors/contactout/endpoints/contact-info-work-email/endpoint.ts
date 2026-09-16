import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zContactInfoQueryParams } from "./schema/inputs.ts";

/**
 * GET /v1/people/linkedin under the WORK key — contacts only, no profile
 * body, for one LinkedIn URL. The personal-email twin is
 * `contact-info-personal-email`.
 *
 * Billing (drill-verified 2026-08-24 / 2026-09-01): one email credit when
 * an address is found, one phone credit when `include_phone` is set and a
 * number is found. A profile with no email of this key's kind answers 404
 * (zero-billed). `email_type=none` draws nothing on the email pool — v1's
 * card still charged its email base there for lack of a "Varies" slot;
 * the counting rule here matches the measured draw (design D11).
 */
export default defineEndpoint({
    meta: {
        displayName: "LinkedIn Contacts Only (Work Email)",
        summary:
            "Contacts only, no profile body, from a LinkedIn URL; bills work email credits.",
        description: "Contacts-only lookup for a single LinkedIn profile " +
            "(for the profile body too, use the LinkedIn Full Profile + " +
            "Contacts endpoint) — this variant returns work email " +
            "addresses only (personal email is a separate endpoint). " +
            "Returns the addresses with per-address verification status, " +
            "phone numbers (with include_phone), and GitHub usernames — no " +
            "profile body, so it is the light, cheap alternative to full " +
            "enrichment. Set email_type=none for a phone-only lookup. A " +
            "profile with no work email on file answers 404 and costs " +
            "nothing. Suited for reveal steps after a search and for " +
            "refreshing stored contact records.",
        docsUrl: "https://api.contactout.com/#contact-info-api-single",
        categories: ["people-enrichment"],
        notes: [
            "Billed per profile: a found work email draws one email " +
            "credit (however many addresses); with include_phone, a found " +
            "phone number draws one phone credit. A 404 miss costs nothing.",
        ],
    },
    endpoint: "/v1/people/linkedin/work-email",
    request: { method: "GET", path: "/v1/people/linkedin" },
    // Both knobs stay honestly optional (design D7): absent means the
    // vendor's own default (this key's emails, no phones), and nothing the
    // caller did not send reaches the wire.
    /** Sends the WORK key (design D1): the provider holds both keys, the
     *  endpoint says which one rides the `token` header. */
    auth: {
        inject: ({ data }) => ({
            ...data.request,
            headers: { ...data.request.headers, token: data.params.workApiKey },
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
                    label: "work emails found",
                    description:
                        "profiles that returned a work email address (however many)",
                    consumes: { credit: "email_work", amount: 1 },
                },
                phone_found: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "phone numbers found",
                    description: "profiles that returned a phone number",
                    consumes: { credit: "phone_work", amount: 1 },
                },
            },
        },
        /** Each contact kind is held only when the request asks for it:
         *  emails unless `email_type=none`, phones with `include_phone`. */
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
        /** v1 `contactInfoUnits`: contacts count when filled. */
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
