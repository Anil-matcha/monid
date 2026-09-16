import { z } from "zod";
import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zBatchAnalysisBody, zBatchTarget } from "./schema/inputs.ts";

/**
 * POST /batch-analysis/batch-analysis — Batch Target Analysis: 21 API units per row (the fixed field set below; design D4).
 */
export default defineEndpoint({
    meta: {
        displayName: "Batch Target Analysis",
        summary:
            "Get Domain Rating, backlinks, and traffic metrics for up to 100 targets at once.",
        description:
            "Analyze up to 100 domains or URLs in one call, one row per " +
            "target. Returns each target's Domain Rating, Ahrefs Rank, " +
            "backlink and referring-domain counts, organic keywords, and " +
            "estimated organic traffic. Supports per-target scope and an " +
            "optional country filter. Suited for bulk domain vetting and " +
            "prospect-list scoring.",
        docsUrl: "https://docs.ahrefs.com/",
        categories: ["seo"],
        notes: [
            "Billing: 21 API units per returned row, minimum 50 units per " +
            "billable request; cache hits and explicit zero consumption are free.",
        ],
    },
    request: { method: "POST", path: "/batch-analysis/batch-analysis" },
    input: {
        schema: {
            // vendor defaults per target at the binding (D25): upstream
            // requires mode AND protocol on every target
            body: zBatchAnalysisBody.extend({
                targets: z.array(zBatchTarget.extend({
                    mode: zBatchTarget.shape.mode.unwrap().default(
                        "subdomains",
                    ),
                    protocol: zBatchTarget.shape.protocol.unwrap().default(
                        "both",
                    ),
                })).min(1).max(100).describe(
                    "Targets to analyze (up to 100; one billed row per target).",
                ),
            }),
        },
        /** The fixed `select` (design D4) rides the JSON body as an array. */
        toRequest: ({ data, utils }) => ({
            ...data.input,
            body: utils.json.merge(data.input.body ?? {}, {
                select: [
                    "url",
                    "mode",
                    "domain_rating",
                    "ahrefs_rank",
                    "backlinks",
                    "org_keywords",
                    "refdomains",
                    "org_traffic",
                ],
            }),
        }),
    },
    usage: {
        /** The vendor formula `max(50, 21 × rows)` as two lines (design
         *  D1): rows at their per-row units, plus the top-up to the 50-unit
         *  request minimum. Both counts are the fns' job (D19).
         *  Rate card: 21 units/row = 6 × 1 + refdomains 5 + org_traffic 10 —
         *  the field costs on
         *  https://docs.ahrefs.com/en/api/reference/batch-analysis/post-batch-analysis
         *  (1 unit per field unless marked; checked 2026-09-16). */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                rows: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "rows",
                    description: "returned rows, 21 API units each",
                    consumes: { credit: "default", amount: 21 },
                },
                minimum_top_up: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.CREDIT,
                    label: "request minimum top-up",
                    description:
                        "units added to reach the 50-unit minimum on billable requests, including empty results",
                    consumes: { credit: "default", amount: 1 },
                },
            },
        },
        /** One row per requested target. */
        estimate: ({ data }) => {
            const rows = data.input.body.targets.length;
            const model = data.usage.model;
            const perRow = model.kind === "COMPOSITE"
                ? model.components["rows"]?.consumes.amount ?? 0
                : 0;
            return {
                counts: {
                    rows,
                    minimum_top_up: Math.max(0, 50 - perRow * rows),
                },
            };
        },
        /** THE generic counter every Ahrefs endpoint states verbatim (one
         *  interned fn): the first array in the body is the rows, a
         *  single-object body counts one row; the top-up is derived from
         *  the doc's own per-row rate. */
        evidence: ({ data, utils }) => {
            // A cache hit or explicit zero meter has no billable rows or
            // minimum. This also keeps the engine's zero-claim fallback free.
            if (
                utils.json.optionalGet(
                    data.lifecycle?.state ?? null,
                    "$.data.actualUnits",
                ) === 0
            ) {
                return { counts: { rows: 0, minimum_top_up: 0 } };
            }
            const model = data.usage.model;
            const perRow = model.kind === "COMPOSITE"
                ? model.components["rows"]?.consumes.amount ?? 0
                : 0;
            let rows = 0;
            const body = data.output;
            if (
                body !== null && typeof body === "object" &&
                !Array.isArray(body)
            ) {
                const values = Object.values(body);
                const list = values.find((value) => Array.isArray(value));
                rows = Array.isArray(list)
                    ? list.length
                    : values.length > 0
                    ? 1
                    : 0;
            }
            return {
                counts: {
                    rows,
                    minimum_top_up: Math.max(0, 50 - perRow * rows),
                },
            };
        },
    },
});
