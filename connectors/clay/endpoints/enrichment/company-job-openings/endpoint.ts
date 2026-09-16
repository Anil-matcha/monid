import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zCompanyJobOpeningsBody } from "./schema/inputs.ts";

/** Clay-managed "Job Openings" — live hiring picture from a domain. */
export default defineEndpoint({
    meta: {
        displayName: "List Company Job Openings",
        summary: "List active job postings at a company from its domain.",
        description: "Returns a company's active hiring picture, keyed by " +
            'website domain: the total open-roles count ("Job Openings") ' +
            "plus details for a sample of postings (title, URL, location " +
            "— upstream caps the detail list at ~10 entries). Supports an " +
            "optional company social profile URL as a disambiguation aid. " +
            "Resolve a bare company name into a domain with the " +
            "company-domain endpoint first. Suited for buying-intent " +
            "signals, growth detection, and department-level priority " +
            "reads. Async: the run is polled to completion (typically " +
            "seconds).",
        docsUrl: "https://developers.clay.com/routines/clay-managed-functions",
        categories: ["jobs", "company-enrichment"],
    },
    endpoint: "/enrichment/company-job-openings",
    request: {
        method: "POST",
        path: "/routines/function%3At_0tk3d4qgqWssSeHvRGk/run",
    },
    input: { schema: { body: zCompanyJobOpeningsBody } },
    usage: {
        /** Two pools, one quantum — see company-domain. Measured per-run
         *  draw (drill 2026-08-20): 0.5 data credit + 1 action. Note the
         *  QUANTUM is the enrichment, not the postings it lists: Clay
         *  charges per run, whatever the openings count. */
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
