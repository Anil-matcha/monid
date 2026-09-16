import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { SEARCH_EXCLUSION_NOTES } from "../../schema/people-search.ts";
import { zPeopleSearchBody } from "./schema/inputs.ts";

/**
 * POST /v1/people/search under the PERSONAL key — filtered search with
 * optional personal-email / phone reveal. The work-email twin is
 * `people-search-work-email`; billing and counting are that file's, on the
 * personal pools. Personal key on the header (design D1).
 */
export default defineEndpoint({
    meta: {
        displayName: "Search People (Personal Email)",
        summary:
            "Find people by title, company, skills, 25+ filters; reveal bills personal email credits.",
        description: "Search 300M+ profiles with filters for name, job " +
            "title (current or past, boolean equations supported), job " +
            "function, seniority, skills, languages, education, location " +
            "(with radius), company (current/past/excluded), domain, " +
            "industry, keyword, company size, years of experience, years " +
            "in current role, and recent job changes. Returns per profile " +
            "the name, title, headline, company details, experience, " +
            "education, skills, and contact-availability flags; set " +
            "reveal_info to also return the actual personal email " +
            "addresses and phone numbers (work email is a separate " +
            "endpoint), data_types to require specific contact kinds, and " +
            "output_fields to slim the payload. Paginate with " +
            "page/page_size (max 25). Suited for prospect-list building " +
            "and candidate sourcing. Size a filter set for free first with " +
            "the Count Matching Profiles endpoint.",
        docsUrl: "https://api.contactout.com/#people-search-api",
        categories: ["people-enrichment"],
        notes: [
            "Billed per profile RETURNED — one search credit each, so a " +
            "short last page costs less than page_size; zero results cost " +
            "nothing. With reveal_info, each profile that carries a " +
            "personal email adds one email credit and each that carries a " +
            "phone number one phone credit.",
            ...SEARCH_EXCLUSION_NOTES,
        ],
    },
    endpoint: "/v1/people/search/personal-email",
    request: { method: "POST", path: "/v1/people/search" },
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
    input: {
        schema: { body: zPeopleSearchBody.required({ page_size: true }) },
    },
    usage: {
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                profiles: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "profiles returned",
                    description: "profiles on the returned page",
                    consumes: { credit: "search_personal", amount: 1 },
                },
                email_reveals: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "personal emails revealed",
                    description:
                        "returned profiles that carried a personal email address (reveal_info only)",
                    consumes: { credit: "email_personal", amount: 1 },
                },
                phone_reveals: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "phone numbers revealed",
                    description:
                        "returned profiles that carried a phone number (reveal_info only)",
                    consumes: { credit: "phone_personal", amount: 1 },
                },
            },
        },
        estimate: ({ data }) => {
            const size = data.input.body.page_size;
            const reveal = data.input.body.reveal_info === true;
            return {
                counts: {
                    profiles: size,
                    email_reveals: reveal ? size : 0,
                    phone_reveals: reveal ? size : 0,
                },
            };
        },
        evidence: ({ data, utils }) => {
            const raw = utils.json.optionalGet(data.output, "$.profiles");
            const profiles = Array.isArray(raw)
                ? raw
                : raw !== undefined && raw !== null && typeof raw === "object"
                ? Object.values(raw)
                : [];
            const filled = (value: unknown): boolean =>
                Array.isArray(value) && value.length > 0;
            let emails = 0;
            let phones = 0;
            for (const entry of profiles) {
                if (
                    entry === null || typeof entry !== "object" ||
                    Array.isArray(entry)
                ) {
                    continue;
                }
                const info = entry.contact_info;
                if (
                    info === undefined || info === null ||
                    typeof info !== "object" || Array.isArray(info)
                ) {
                    continue;
                }
                if (
                    filled(info.emails) || filled(info.work_emails) ||
                    filled(info.personal_emails)
                ) {
                    emails = emails + 1;
                }
                if (filled(info.phones)) phones = phones + 1;
            }
            return {
                counts: {
                    profiles: profiles.length,
                    email_reveals: emails,
                    phone_reveals: phones,
                },
            };
        },
    },
});
