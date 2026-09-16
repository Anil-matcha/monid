import { z } from "zod";
import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { AT_LEAST_ONE_IDENTIFIER, zEnrichPersonBody } from "./schema/inputs.ts";

/** Clay-managed "Enrich person" — a structured profile from a URL or email. */
export default defineEndpoint({
    meta: {
        displayName: "Enrich Person",
        summary:
            "Get a person's profile, title, and work history from a LinkedIn URL or email.",
        description: "Resolves one person from a LinkedIn profile URL or " +
            "an email address into a structured professional profile. " +
            'Returns { "Enrich person": { name, title, org, headline, ' +
            "country, location_name, experience[] (company, " +
            "company_domain, title, dates, is_current), education[], " +
            "languages[], num_followers, picture_url_orig, url } }. " +
            "Provide at least one of 'Professional Profile URL' or " +
            "'Email' — a body with neither is rejected before the wire. " +
            "Chain onward: pass name, company_domain and org to the " +
            "work-email endpoint, or url, name and org to the " +
            "mobile-phone endpoint. Suited for lead qualification, " +
            "persona checks, and contact-record completion. Async: the " +
            "run is polled to completion (typically seconds).",
        docsUrl: "https://developers.clay.com/routines/clay-managed-functions",
        categories: ["people-enrichment"],
        // The at-least-one-identifier rule is NOT here: it survives into
        // the compiled input schema as an `anyOf` (design D13), so the
        // contract states it where a caller's tooling will see it.
        notes: [
            "A person the waterfall cannot resolve completes with an " +
            "empty result and draws nothing.",
        ],
    },
    endpoint: "/enrichment/person",
    request: {
        method: "POST",
        path: "/routines/function%3At_0tkthabYBa6XQgknKwF/run",
    },
    // "At least one identifier" is OUR rule (Clay declares no required
    // field), so it binds HERE and the mirror stays vendor-faithful
    // (design D25). A union is the form that SURVIVES compilation — it
    // becomes `anyOf` with a one-key `required` per arm, which ajv
    // enforces pre-wire as INVALID_INPUT; a `.refine` would be dropped
    // silently and guard nothing (design D13, pdl's precedent).
    input: {
        schema: {
            body: z.union([
                zEnrichPersonBody.required({
                    "Professional Profile URL": true,
                }),
                zEnrichPersonBody.required({ "Email": true }),
            ]).describe(AT_LEAST_ONE_IDENTIFIER),
        },
    },
    usage: {
        /** Two pools, one quantum — see company-domain. Measured per-run
         *  draw (drill 2026-09-08): 0.5 data credit + 1 action. A person
         *  the waterfall cannot resolve draws nothing. */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                enrichment_credits: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "enrichments",
                    description: "completed enrichments with a result",
                    consumes: { credit: "data_credit", amount: 0.5 },
                },
                enrichment_actions: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "enrichment actions",
                    description: "actions consumed by the routine run",
                    consumes: { credit: "action", amount: 1 },
                },
            },
        },
        estimate: () => ({
            counts: { enrichment_credits: 1, enrichment_actions: 1 },
        }),
        evidence: ({ data, utils }) => {
            const items = utils.json.optionalGet(data.output, "$.data");
            const hits = !Array.isArray(items) ? 0 : items.filter((item) => {
                if (
                    item === null || typeof item !== "object" ||
                    Array.isArray(item) || item.status !== "complete"
                ) {
                    return false;
                }
                const result = item.result;
                if (
                    result === null || typeof result !== "object" ||
                    Array.isArray(result)
                ) {
                    return false;
                }
                return Object.values(result).some((value) =>
                    value !== null && value !== "" &&
                    !(typeof value === "object" && value !== null &&
                        !Array.isArray(value) &&
                        Object.keys(value).length === 0)
                );
            }).length;
            return {
                counts: {
                    enrichment_credits: hits,
                    enrichment_actions: hits,
                },
            };
        },
    },
});
