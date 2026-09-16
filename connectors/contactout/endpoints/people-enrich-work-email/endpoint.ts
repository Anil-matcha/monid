import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { PEOPLE_ENRICH_IDENTIFIER_NOTE } from "../../schema/people-enrich.ts";
import { zPeopleEnrichBody } from "./schema/inputs.ts";

/**
 * POST /v1/people/enrich under the WORK key — flexible person match by any
 * identifier mix, with optional work-email / phone reveal. The
 * personal-email twin is `people-enrich-personal-email`.
 *
 * Billing (drill-verified): EVERY match draws one search credit — unlike
 * `/v1/linkedin/enrich`, there is no either/or here — and each requested
 * contact kind draws its credit when found. A miss answers 404 (zero-billed
 * as error-as-data).
 */
export default defineEndpoint({
    meta: {
        displayName: "Enrich Person (Work Email)",
        summary:
            "Match a person by any identifier mix; contact reveal bills work email credits.",
        description: "Flexible person enrichment: provide a LinkedIn URL, " +
            "email, or phone — or a name plus company/education/location — " +
            "and get the matched profile. Returns name, headline, " +
            "industry, LinkedIn URL, current company details, experience, " +
            "education, skills, certifications, and seniority; add the " +
            "include parameter to also return the work email address " +
            "and/or phone number (personal email is a separate endpoint). " +
            "More identifiers improve the match. A no-match answers 404 " +
            "and costs nothing.",
        docsUrl: "https://api.contactout.com/#people-enrich-api",
        categories: ["people-enrichment"],
        notes: [
            PEOPLE_ENRICH_IDENTIFIER_NOTE,
            "Billed per match: every matched profile draws one search " +
            "credit; a returned work email adds one email credit and a " +
            "returned phone number one phone credit. A 404 miss costs " +
            "nothing.",
        ],
    },
    endpoint: "/v1/people/enrich/work-email",
    request: { method: "POST", path: "/v1/people/enrich" },
    /** Sends the WORK key (design D1): the provider holds both keys, the
     *  endpoint says which one rides the `token` header. */
    auth: {
        inject: ({ data }) => ({
            ...data.request,
            headers: { ...data.request.headers, token: data.params.workApiKey },
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
                    consumes: { credit: "search_work", amount: 1 },
                },
                email_found: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "work emails found",
                    description:
                        "matches that returned a work email address (however many)",
                    consumes: { credit: "email_work", amount: 1 },
                },
                phone_found: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "phone numbers found",
                    description: "matches that returned a phone number",
                    consumes: { credit: "phone_work", amount: 1 },
                },
            },
        },
        /** The match credit always; a contact credit only when that kind
         *  was requested (`include` is optional — honest optionality, an
         *  absent list requests nothing). */
        estimate: ({ data }) => {
            const include = data.input.body.include ?? [];
            return {
                counts: {
                    profile_matched: 1,
                    email_found: include.includes("work_email") ? 1 : 0,
                    phone_found: include.includes("phone") ? 1 : 0,
                },
            };
        },
        /** v1 `peopleEnrichUnits`: an object profile IS a match; contacts
         *  count when filled, in either dialect. */
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
