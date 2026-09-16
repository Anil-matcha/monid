import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zCompanyDomainBody } from "./schema/inputs.ts";

/**
 * Clay-managed "Company Domain" — resolve a company name to its primary
 * website domain. The routine id is baked into `request.path` (v1
 * `ROUTINE_IDS.companyDomain`, percent-encoded exactly as v1 sent it); the
 * raw `/routines/{routine_id}/run` surface stays unexposed so our
 * workspace's custom functions are never addressable.
 *
 * Async: the provider's `lifecycle.start`/`poll` do the whole submit →
 * 202 → results protocol.
 */
export default defineEndpoint({
    meta: {
        displayName: "Find Company Domain from Name",
        summary: "Resolve a company name to its primary website domain.",
        description: "Resolves a company name to its primary website " +
            "domain via a Clay-managed enrichment waterfall. Returns " +
            "{ Domain }. The domain is the key that unlocks the other " +
            "company enrichments: pass it as 'Company Domain' to the " +
            "employee-count, industry, and job-openings endpoints. " +
            "Async: the run is polled to completion (typically seconds).",
        docsUrl: "https://developers.clay.com/routines/clay-managed-functions",
        categories: ["company-enrichment"],
        /** The one caveat that makes this endpoint dangerous to chain
         *  blindly: it cannot miss, so a wrong answer is indistinguishable
         *  from a right one at the call site — and the three company
         *  functions downstream will happily enrich the wrong company. */
        notes: [
            "The matcher is fuzzy and ALWAYS answers. An unrecognized or " +
            "ambiguous name returns a plausible but wrong domain rather " +
            "than an empty result — and draws for it — so verify the " +
            "domain before chaining it into the other company " +
            "enrichments.",
        ],
    },
    endpoint: "/enrichment/company-domain",
    request: {
        method: "POST",
        path: "/routines/function%3At_0tk3d4qnbeQmcGWPukV/run",
    },
    input: { schema: { body: zCompanyDomainBody } },
    usage: {
        /** ONE routine run draws from TWO pools at once, so each quantum
         *  needs one line per pool (design D26 — a line pins exactly one
         *  `consumes.credit`). Both count the SAME quantum: one completed,
         *  non-empty enrichment. Measured per-run draw (drill 2026-08-20,
         *  `clay credits balance` diffs closed to ±0): 1.0 data credit +
         *  1 action. The vendor's own `estimatedCreditCost` quoted 0.8 —
         *  measurement wins. */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                enrichment_credits: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "enrichments",
                    description: "completed enrichments with a result",
                    consumes: { credit: "data_credit", amount: 1.0 },
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
        /** One submitted item ⇒ at most one enrichment. ≥2 metered
         *  components force BOTH quantity fns doc-level (the generic
         *  provider keying cannot choose a line), so every enrichment doc
         *  states them; the sources are identical and intern to one
         *  fnTable entry each. */
        estimate: () => ({
            counts: { enrichment_credits: 1, enrichment_actions: 1 },
        }),
        /** Settle counts items that completed with a NON-EMPTY result (v1
         *  `extractBilledUnits` + `hasResultValue`): a failed item is
         *  never billed, and neither is a waterfall that found nothing —
         *  Clay answers `complete` with `{}` or `{"<Field>": ""}` and,
         *  for this function, draws nothing (measured). */
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
