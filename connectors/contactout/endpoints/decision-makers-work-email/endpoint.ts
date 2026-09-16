import { z } from "zod";
import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import {
    AT_LEAST_ONE_COMPANY_IDENTIFIER,
    zDecisionMakersQueryParams,
} from "./schema/inputs.ts";

/**
 * GET /v1/people/decision-makers under the WORK key — a company's key
 * decision makers, with optional work-email / phone reveal. The
 * personal-email twin is `decision-makers-personal-email`.
 *
 * Same counting as people-search (one search credit per profile returned,
 * reveal adds email/phone per profile where found), with one vendor quirk
 * the hold has to respect: the page size is FIXED at 25 upstream —
 * `page_size` is ignored (drill-verified) — so the promise is always the
 * full page.
 */
export default defineEndpoint({
    meta: {
        displayName: "Find Decision Makers (Work Email)",
        summary:
            "List a company's decision makers; contact reveal bills work email credits.",
        description: "Company in, its leadership out: identify a company by " +
            "LinkedIn URL, domain, or name and get its key decision makers " +
            "— per person the name, title, headline, company context, " +
            "experience, education, skills, seniority, and " +
            "contact-availability flags; set reveal_info to include the " +
            "actual work email addresses and phone numbers (personal email " +
            "is a separate endpoint). Returns up to 25 people per page " +
            "(the page size is fixed upstream). Suited for account-based " +
            "outreach and finding the right buyer at a target company.",
        docsUrl: "https://api.contactout.com/#decision-makers-api",
        categories: ["people-enrichment"],
        notes: [
            "Billed per profile returned — the page size is FIXED at 25 " +
            "upstream, so a large company bills up to 25 search credits " +
            "per page. With reveal_info, each profile that carries a work " +
            "email adds one email credit and each that carries a phone " +
            "number one phone credit.",
        ],
    },
    endpoint: "/v1/people/decision-makers/work-email",
    request: { method: "GET", path: "/v1/people/decision-makers" },
    /** Sends the WORK key (design D1): the provider holds both keys, the
     *  endpoint says which one rides the `token` header. */
    auth: {
        inject: ({ data }) => ({
            ...data.request,
            headers: { ...data.request.headers, token: data.params.workApiKey },
        }),
    },
    input: {
        schema: {
            // "At least one of linkedin_url, domain, or name" is the
            // vendor's rule; a union is the form that SURVIVES compilation
            // (`anyOf`, one-key `required` per arm) — a `.refine` would be
            // dropped silently and guard nothing (clay D13, pdl precedent).
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
                    consumes: { credit: "search_work", amount: 1 },
                },
                email_reveals: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "work emails revealed",
                    description:
                        "returned profiles that carried a work email address (reveal_info only)",
                    consumes: { credit: "email_work", amount: 1 },
                },
                phone_reveals: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "phone numbers revealed",
                    description:
                        "returned profiles that carried a phone number (reveal_info only)",
                    consumes: { credit: "phone_work", amount: 1 },
                },
            },
        },
        /** The fixed 25-profile page is DEDUCED from the vendor (page_size
         *  is ignored upstream — drill 2026-08-24), not a fallback. */
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
        // source-identical to people-search's evidence ⇒ one fnTable entry
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
