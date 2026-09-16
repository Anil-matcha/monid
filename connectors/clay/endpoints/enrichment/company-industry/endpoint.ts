import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zCompanyIndustryBody } from "./schema/inputs.ts";

/** Clay-managed "Industry" — sector classification from a company domain. */
export default defineEndpoint({
    meta: {
        displayName: "Classify Company Industry",
        summary: "Classify a company's industry from its domain.",
        description: "Classifies which industry or sector a company " +
            "operates in, keyed by website domain. Returns { Industry } — " +
            "a classified label such as 'Software Development'. Supports " +
            "an optional company name and social profile URL as " +
            "disambiguation aids. Resolve a bare company name into a " +
            "domain with the company-domain endpoint first. Suited for " +
            "ICP filtering, segmentation, and routing. Async: the run is " +
            "polled to completion (typically seconds).",
        docsUrl: "https://developers.clay.com/routines/clay-managed-functions",
        categories: ["company-enrichment"],
    },
    endpoint: "/enrichment/company-industry",
    request: {
        method: "POST",
        path: "/routines/function%3At_0tk3d4qYNTzEG7jKkai/run",
    },
    input: { schema: { body: zCompanyIndustryBody } },
    usage: {
        /** Two pools, one quantum — see company-domain. Measured per-run
         *  draw (drill 2026-08-20): 0.5 data credit + 1 action. */
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
