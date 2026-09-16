import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { PEOPLE_ENRICH_IDENTIFIER_NOTE } from "../../schema/people-enrich.ts";
import { zPeopleEnrichBody } from "./schema/inputs.ts";

/**
 * POST /v1/people/enrich under the PERSONAL key — flexible person match
 * with optional personal-email / phone reveal. The work-email twin is
 * `people-enrich-work-email`; billing and counting are that file's, on the
 * personal pools. Personal key on the header (design D1).
 */
export default defineEndpoint({
    meta: {
        displayName: "Enrich Person (Personal Email)",
        summary:
            "Match a person by any identifier mix; contact reveal bills personal email credits.",
        description: "Flexible person enrichment: provide a LinkedIn URL, " +
            "email, or phone — or a name plus company/education/location — " +
            "and get the matched profile. Returns name, headline, " +
            "industry, LinkedIn URL, current company details, experience, " +
            "education, skills, certifications, and seniority; add the " +
            "include parameter to also return the personal email address " +
            "and/or phone number (work email is a separate endpoint). " +
            "More identifiers improve the match. A no-match answers 404 " +
            "and costs nothing.",
        docsUrl: "https://api.contactout.com/#people-enrich-api",
        categories: ["people-enrichment"],
        notes: [
            PEOPLE_ENRICH_IDENTIFIER_NOTE,
            "Billed per match: every matched profile draws one search " +
            "credit; a returned personal email adds one email credit and " +
            "a returned phone number one phone credit. A 404 miss costs " +
            "nothing.",
        ],
    },
    endpoint: "/v1/people/enrich/personal-email",
    request: { method: "POST", path: "/v1/people/enrich" },
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
    input: { schema: { body: zPeopleEnrichBody } },
    usage: {
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                profile_matched: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "profiles matched",
                    description: "matched profiles — every hit draws one",
                    consumes: { credit: "search_personal", amount: 1 },
                },
                email_found: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "personal emails found",
                    description:
                        "matches that returned a personal email address (however many)",
                    consumes: { credit: "email_personal", amount: 1 },
                },
                phone_found: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "phone numbers found",
                    description: "matches that returned a phone number",
                    consumes: { credit: "phone_personal", amount: 1 },
                },
            },
        },
        estimate: ({ data }) => {
            const include = data.input.body.include ?? [];
            return {
                counts: {
                    profile_matched: 1,
                    email_found: include.includes("personal_email") ? 1 : 0,
                    phone_found: include.includes("phone") ? 1 : 0,
                },
            };
        },
        evidence: ({ data, utils }) => {
            const profile = utils.json.optionalGet(data.output, "$.profile");
            if (
                profile === undefined || profile === null ||
                typeof profile !== "object" || Array.isArray(profile)
            ) {
                return {
                    counts: {
                        profile_matched: 0,
                        email_found: 0,
                        phone_found: 0,
                    },
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
                    profile_matched: 1,
                    email_found: email,
                    phone_found: phone,
                },
            };
        },
    },
});
