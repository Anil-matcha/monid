import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zCompanyEmployeeCountBody } from "./schema/inputs.ts";

/** Clay-managed "Employee Count" — headcount from a company domain. */
export default defineEndpoint({
    meta: {
        displayName: "Get Company Employee Count",
        summary: "Get a company's current employee headcount from its domain.",
        description: "Returns a company's current employee headcount " +
            "pulled from multiple data sources, keyed by website domain. " +
            'Returns { "Employee Count" } (a numeric string). Supports an ' +
            "optional company name and social profile URL as " +
            "disambiguation aids. Resolve a bare company name into a " +
            "domain with the company-domain endpoint first. Suited for " +
            "company sizing, ICP qualification, and territory " +
            "segmentation. Async: the run is polled to completion " +
            "(typically seconds).",
        docsUrl: "https://developers.clay.com/routines/clay-managed-functions",
        categories: ["company-enrichment"],
    },
    endpoint: "/enrichment/company-employee-count",
    request: {
        method: "POST",
        path: "/routines/function%3At_0tk3d4qtXDqcq8edu5B/run",
    },
    input: { schema: { body: zCompanyEmployeeCountBody } },
    usage: {
        /** Two pools, one quantum — see company-domain. Measured per-run
         *  draw (drill 2026-08-20): 0.5 data credit + 1 action (the
         *  vendor quoted 2.0-2.8; measurement wins). */
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
