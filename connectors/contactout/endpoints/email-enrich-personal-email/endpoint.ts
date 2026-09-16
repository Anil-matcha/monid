import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zEmailEnrichQueryParams } from "./schema/inputs.ts";

/**
 * GET /v1/email/enrich under the PERSONAL key — the person behind an
 * email address, with the personal address and phone. The work-email
 * twin is `email-enrich-work-email`; billing and counting are that
 * file's, on the personal pools. Personal key on the header (design D1).
 */
export default defineEndpoint({
    meta: {
        displayName: "Profile from Email (Personal Email)",
        summary:
            "Email in, profile with personal email and phone out; bills personal email credits.",
        description: "One email address in, the person behind it out — " +
            "this variant returns the personal email address only (work " +
            "email is a separate endpoint). Returns full name, headline, " +
            "industry, LinkedIn URL, profile picture, phone number, " +
            "Twitter and GitHub handles, current company (domain, size, " +
            "revenue, locations), work experience, education, skills, " +
            "certifications, and follower count. Personal addresses match " +
            "best; work addresses are matched against the current " +
            "employer. An unknown address answers 404 and costs nothing.",
        docsUrl: "https://api.contactout.com/#from-email-address",
        categories: ["people-enrichment"],
        notes: [
            "Billed per hit: a returned personal email draws one email " +
            "credit, a returned phone number one phone credit; a profile " +
            "that comes back with neither draws one search credit. A 404 " +
            "miss costs nothing.",
        ],
    },
    endpoint: "/v1/email/enrich/personal-email",
    request: { method: "GET", path: "/v1/email/enrich" },
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
    input: { schema: { queryParams: zEmailEnrichQueryParams } },
    usage: {
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                email_found: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "personal emails found",
                    description:
                        "hits that returned a personal email address (however many)",
                    consumes: { credit: "email_personal", amount: 1 },
                },
                phone_found: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "phone numbers found",
                    description: "hits that returned a phone number",
                    consumes: { credit: "phone_personal", amount: 1 },
                },
                profile_only: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "profiles without contacts",
                    description:
                        "hits that returned no billable contact — the vendor's either/or search credit",
                    consumes: { credit: "search_personal", amount: 1 },
                },
            },
        },
        estimate: () => ({ counts: { email_found: 1, phone_found: 1 } }),
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
