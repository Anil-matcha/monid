import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zLinkedinEnrichQueryParams } from "./schema/inputs.ts";

/**
 * GET /v1/linkedin/enrich under the WORK key — full profile + work-email
 * contacts from a LinkedIn URL. The personal-email twin is
 * `linkedin-enrich-personal-email`; same wire path, other key.
 *
 * Billing is the vendor's EITHER/OR (design D3, drill-verified 2026-09-01):
 * a profile that returns contacts draws email and/or phone credits; a
 * profile that returns NONE — `profile_only=true`, nothing on file, or
 * only the OTHER email kind (this key answers those arrays empty) — draws
 * exactly one search credit; a miss (200 with `profile: []`) draws nothing.
 * Selection is a counting rule owned by `evidence` (D19), never a model
 * shape.
 */
export default defineEndpoint({
    meta: {
        displayName: "LinkedIn Full Profile + Contacts (Work Email)",
        summary:
            "Full LinkedIn profile plus contacts from a profile URL; bills work email credits.",
        description: "One LinkedIn profile URL in, the complete person " +
            "record out — the full profile body PLUS contacts (for contacts " +
            "alone, use the LinkedIn Contacts Only endpoint). This variant " +
            "returns work email addresses only (personal email is a " +
            "separate endpoint). Returns the work email addresses, phone " +
            "numbers, GitHub and Twitter handles, full name, headline, " +
            "industry, location, current company (with domain, size, " +
            "revenue, funding), work experience, education, skills, " +
            "certifications, publications, projects, volunteering, " +
            "follower count, job function, seniority, and open-to-work " +
            "status. Supports profile_only to fetch the profile without " +
            "contact data at a lower cost. Suited for candidate sourcing, " +
            "lead qualification, and CRM enrichment from a LinkedIn URL.",
        docsUrl: "https://api.contactout.com/#linkedin-profile-api",
        categories: ["people-enrichment"],
        notes: [
            "Billed per profile: a found work email draws one email " +
            "credit (however many addresses), a found phone number one " +
            "phone credit. A matched profile that returns NO contact — " +
            "profile_only, nothing on file, or only a personal email — " +
            "draws one search credit instead. An unknown profile costs " +
            "nothing.",
        ],
    },
    /** PUBLIC identity (design D5): the wire path is shared with the
     *  personal-email twin, so the id carries the v1 key suffix. */
    endpoint: "/v1/linkedin/enrich/work-email",
    request: { method: "GET", path: "/v1/linkedin/enrich" },
    // `profile_only` stays honestly optional (design D7): absent means the
    // vendor's own default (contacts included), and nothing the caller did
    // not send reaches the wire.
    /** Sends the WORK key (design D1): the provider holds both keys, the
     *  endpoint says which one rides the `token` header. */
    auth: {
        inject: ({ data }) => ({
            ...data.request,
            headers: { ...data.request.headers, token: data.params.workApiKey },
        }),
    },
    input: { schema: { queryParams: zLinkedinEnrichQueryParams } },
    // auth (work key), timeouts, fromError inherit from the provider
    usage: {
        /** Three vendor credits, one line each, all `amount: 1` — the
         *  pools ARE the vendor's units (design D2); the $/credit is the
         *  broker card's job. */
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
                profile_only: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "profiles without contacts",
                    description:
                        "matched profiles that returned no billable contact — the vendor's either/or search credit",
                    consumes: { credit: "search_work", amount: 1 },
                },
            },
        },
        /** Worst case off the card: with `profile_only` the only possible
         *  draw is the search credit; otherwise a profile with both
         *  contacts. A subset of the metered ids is a legal promise. */
        estimate: ({ data }) => {
            if (data.input.queryParams.profile_only === true) {
                return { counts: { profile_only: 1 } };
            }
            return { counts: { email_found: 1, phone_found: 1 } };
        },
        /** Count from the RAW body (v1 `enrichUnits`). The miss shape is
         *  `profile: []` — an array, not an object — so anything but an
         *  object profile counts zero everywhere. Both profile dialects
         *  are read: snake_case arrays (`email`, `work_email`,
         *  `personal_email`, `phone`) and camelCase scalars (`workEmail`,
         *  a string `email` / `phone`). */
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
