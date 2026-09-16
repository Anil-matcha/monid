import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zSerpOverviewQueryParams } from "./schema/inputs.ts";

/**
 * GET /serp-overview/serp-overview — SERP Overview: 20 API units per row (the fixed field set below; design D4).
 */
export default defineEndpoint({
    meta: {
        displayName: "SERP Overview",
        summary:
            "Get the top organic results for a keyword with ratings, backlinks, and traffic.",
        description:
            "Get the top organic search results for a keyword in one " +
            "country, one row per position. Returns the position, URL, page " +
            "title, URL Rating, backlink and referring-domain counts, and " +
            "estimated traffic of each result. Supports an optional " +
            "historical date and a top_positions budget. Suited for SERP " +
            "difficulty analysis and ranking-feasibility checks.",
        docsUrl: "https://docs.ahrefs.com/",
        categories: ["seo"],
        notes: [
            "Billing: 20 API units per returned row, minimum 50 units per " +
            "request \u2014 an empty result still draws 50.",
        ],
    },
    request: { method: "GET", path: "/serp-overview/serp-overview" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the row budget is REQUIRED — the estimate's whole basis
            queryParams: zSerpOverviewQueryParams.required({
                top_positions: true,
            }),
        },
        /** The fixed `select` (design D4) — callers never supply it. */
        toRequest: ({ data }) => ({
            ...data.input,
            queryParams: {
                ...data.input.queryParams,
                select: "position,url,title,url_rating,backlinks,refdomains," +
                    "traffic",
            },
        }),
    },
    usage: {
        /** The vendor formula `max(50, 20 × rows)` as two lines (design
         *  D1): rows at their per-row units, plus the top-up to the 50-unit
         *  request minimum. Both counts are the fns' job (D19).
         *  Rate card: 20 units/row = 5 × 1 + refdomains 5 + traffic 10 — the
         *  field costs on
         *  https://docs.ahrefs.com/en/api/reference/serp-overview/get-serp-overview
         *  (1 unit per field unless marked; checked 2026-09-16). */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                rows: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "rows",
                    description: "returned rows, 20 API units each",
                    consumes: { credit: "default", amount: 20 },
                },
                minimum_top_up: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.CREDIT,
                    label: "request minimum top-up",
                    description:
                        "units added to reach the 50-unit per-request minimum (drawn even on an empty result)",
                    consumes: { credit: "default", amount: 1 },
                },
            },
        },
        /** The requested positions are the promise. */
        estimate: ({ data }) => {
            const rows = data.input.queryParams.top_positions;
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
        evidence: ({ data }) => {
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
