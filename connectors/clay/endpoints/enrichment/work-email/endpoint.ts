import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zWorkEmailBody } from "./schema/inputs.ts";

/** Clay-managed "Work Email" — a multi-vendor verified-email waterfall. */
export default defineEndpoint({
    meta: {
        displayName: "Find Work Email",
        summary:
            "Find a person's verified work email from their name and company domain.",
        description: "Cascades a person through multiple email vendors in " +
            "sequence until one returns a VERIFIED address, keyed by full " +
            'name + company domain + company name. Returns { "Work ' +
            'Email" }, or an empty result when no vendor verifies an ' +
            "address. Supports the person's LinkedIn URL, the company's " +
            "LinkedIn URL, and a personal email as extra clues. Chain " +
            "onward: pass the found address as 'Email' to the " +
            "enrich-person endpoint, or the LinkedIn URL as 'Social " +
            "Profile URL' with the same name and company to the " +
            "mobile-phone endpoint. Suited for outreach list building " +
            "and CRM contact completion. Async: the run is polled to " +
            "completion.",
        docsUrl: "https://developers.clay.com/routines/clay-managed-functions",
        categories: ["people-enrichment"],
        /** A waterfall's worst case is its MISS, not its hit — both the
         *  latency and the billing surprise land there. */
        notes: [
            "A miss can take up to ~3 minutes: every vendor in the " +
            "waterfall is tried before the run completes empty. A hit " +
            "usually settles in seconds.",

            "An empty result (no vendor verified an address) draws " +
            "nothing.",
        ],
    },
    endpoint: "/enrichment/work-email",
    request: {
        method: "POST",
        path: "/routines/function%3At_0tkthaoxGPkkYMWFjN2/run",
    },
    input: { schema: { body: zWorkEmailBody } },
    usage: {
        /** Two pools, one quantum — see company-domain. Measured per-run
         *  draw (drill 2026-09-08): 0.6 data credit + 2 actions — the
         *  second action is the verification pass (the vendor quoted 1.1
         *  credits; measurement wins). A miss draws NOTHING here. */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                enrichment_credits: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "enrichments",
                    description: "completed enrichments with a result",
                    consumes: { credit: "data_credit", amount: 0.6 },
                },
                enrichment_actions: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "enrichment actions",
                    description: "actions consumed by the routine run",
                    consumes: { credit: "action", amount: 2 },
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
