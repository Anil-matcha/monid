import { z } from "zod";
import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import {
    AT_LEAST_ONE_COMPANY_IDENTIFIER,
    zDecisionMakersQueryParams,
} from "./schema/inputs.ts";

/**
 * GET /v1/people/decision-makers under the PERSONAL key — a company's key
 * decision makers with optional personal-email / phone reveal. The
 * work-email twin is `decision-makers-work-email`; billing and counting are
 * that file's, on the personal pools. Personal key on the header (D1).
 */
export default defineEndpoint({
    meta: {
        displayName: "Find Decision Makers (Personal Email)",
        summary:
            "List a company's decision makers; contact reveal bills personal email credits.",
        description: "Company in, its leadership out: identify a company by " +
            "LinkedIn URL, domain, or name and get its key decision makers " +
            "— per person the name, title, headline, company context, " +
            "experience, education, skills, seniority, and " +
            "contact-availability flags; set reveal_info to include the " +
            "actual personal email addresses and phone numbers (work email " +
            "is a separate endpoint). Returns up to 25 people per page " +
            "(the page size is fixed upstream). Suited for account-based " +
            "outreach and finding the right buyer at a target company.",
        docsUrl: "https://api.contactout.com/#decision-makers-api",
        categories: ["people-enrichment"],
        notes: [
            "Billed per profile returned — the page size is FIXED at 25 " +
            "upstream, so a large company bills up to 25 search credits " +
            "per page. With reveal_info, each profile that carries a " +
            "personal email adds one email credit and each that carries a " +
            "phone number one phone credit.",
        ],
    },
    endpoint: "/v1/people/decision-makers/personal-email",
    request: { method: "GET", path: "/v1/people/decision-makers" },
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
        schema: {
            queryParams: z.union([
                zDecisionMakersQueryParams.required({ linkedin_url: true }),
                zDecisionMakersQueryParams.required({ domain: true }),
                zDecisionMakersQueryParams.required({ name: true }),
            ]).describe(AT_LEAST_ONE_COMPANY_IDENTIFIER),
        },
    },
    usage: {
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                profiles: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "profiles returned",
                    description: "decision makers on the returned page",
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
            const reveal = data.input.queryParams.reveal_info === true;
            return {
                counts: {
                    profiles: 25,
                    email_reveals: reveal ? 25 : 0,
                    phone_reveals: reveal ? 25 : 0,
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
