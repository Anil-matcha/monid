import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zLinkedinEnrichQueryParams } from "./schema/inputs.ts";

/**
 * GET /v1/linkedin/enrich under the PERSONAL key — full profile +
 * personal-email contacts from a LinkedIn URL. The work-email twin is
 * `linkedin-enrich-work-email`; same wire path, other key. Billing and
 * counting are that file's, on the personal pools.
 *
 * The PERSONAL key rides the header (design D1): this doc overrides the
 * provider's work-key `auth` with the personal credential shape and its
 * own inline inject, so the compiled doc requires exactly `personalApiKey`.
 */
export default defineEndpoint({
    meta: {
        displayName: "LinkedIn Full Profile + Contacts (Personal Email)",
        summary:
            "Full LinkedIn profile plus contacts from a profile URL; bills personal email credits.",
        description: "One LinkedIn profile URL in, the complete person " +
            "record out — the full profile body PLUS contacts (for contacts " +
            "alone, use the LinkedIn Contacts Only endpoint). This variant " +
            "returns personal email addresses only (work email is a " +
            "separate endpoint). Returns the personal email addresses, " +
            "phone numbers, GitHub and Twitter handles, full name, " +
            "headline, industry, location, current company (with domain, " +
            "size, revenue, funding), work experience, education, skills, " +
            "certifications, publications, projects, volunteering, " +
            "follower count, job function, seniority, and open-to-work " +
            "status. Supports profile_only to fetch the profile without " +
            "contact data at a lower cost. Suited for candidate sourcing, " +
            "lead qualification, and CRM enrichment from a LinkedIn URL.",
        docsUrl: "https://api.contactout.com/#linkedin-profile-api",
        categories: ["people-enrichment"],
        notes: [
            "Billed per profile: a found personal email draws one email " +
            "credit (however many addresses), a found phone number one " +
            "phone credit. A matched profile that returns NO contact — " +
            "profile_only, nothing on file, or only a work email — draws " +
            "one search credit instead. An unknown profile costs nothing.",
        ],
    },
    endpoint: "/v1/linkedin/enrich/personal-email",
    request: { method: "GET", path: "/v1/linkedin/enrich" },
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
    input: { schema: { queryParams: zLinkedinEnrichQueryParams } },
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
                profile_only: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "profiles without contacts",
                    description:
                        "matched profiles that returned no billable contact — the vendor's either/or search credit",
                    consumes: { credit: "search_personal", amount: 1 },
                },
            },
        },
        // source-identical to the work twin ⇒ one interned fnTable entry
        estimate: ({ data }) => {
            if (data.input.queryParams.profile_only === true) {
                return { counts: { profile_only: 1 } };
            }
            return { counts: { email_found: 1, phone_found: 1 } };
        },
        evidence: ({ data, utils }) => {
            const profile = utils.json.optionalGet(data.output, "$.profile");
            if (
                profile === undefined || profile === null ||
                typeof profile !== "object" || Array.isArray(profile)
            ) {
                return {
                    counts: { email_found: 0, phone_found: 0, profile_only: 0 },
                };
            }
            const filled = (value: unknown): boolean =>
                Array.isArray(value)
                    ? value.length > 0
                    : typeof value === "string" && value.trim() !== "";
            const email = filled(profile.email) || filled(profile.work_email) ||
                    filled(profile.personal_email) || filled(profile.workEmail)
                ? 1
                : 0;
            const phone = filled(profile.phone) ? 1 : 0;
            return {
                counts: {
                    email_found: email,
                    phone_found: phone,
                    profile_only: email === 0 && phone === 0 ? 1 : 0,
                },
            };
        },
    },
});
