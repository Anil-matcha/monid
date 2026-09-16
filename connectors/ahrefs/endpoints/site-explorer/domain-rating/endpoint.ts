import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zDomainRatingQueryParams } from "./schema/inputs.ts";

/**
 * GET /site-explorer/domain-rating — Domain Rating: 2 API units per row (all returned fields, one row).
 */
export default defineEndpoint({
    meta: {
        displayName: "Domain Rating",
        summary:
            "Get a target's Domain Rating (0-100 link authority) and its global rank.",
        description:
            "Get a domain's Domain Rating \u2014 the 0-100 backlink-authority " +
            "score the SEO industry quotes \u2014 and its global rank by that " +
            "score, as of the given date. Suited for authority checks in " +
            "outreach vetting, domain valuation, and competitor " +
            "comparisons.",
        docsUrl: "https://docs.ahrefs.com/",
        categories: ["seo"],
        notes: [
            "Billing: 2 API units per returned row, minimum 50 units per " +
            "billable request; cache hits and explicit zero consumption are free.",
        ],
    },
    request: { method: "GET", path: "/site-explorer/domain-rating" },
    input: {
        schema: {
            // vendor defaults at the binding (D25)
            queryParams: zDomainRatingQueryParams,
        },
    },
    usage: {
        /** The vendor formula `max(50, 2 × rows)` as two lines (design
         *  D1): rows at their per-row units, plus the top-up to the 50-unit
         *  request minimum. Both counts are the fns' job (D19).
         *  Rate card: 2 units/row = all returned fields, 2 × 1 — the field
         *  costs on
         *  https://docs.ahrefs.com/en/api/reference/site-explorer/get-domain-rating
         *  (1 unit per field unless marked; checked 2026-09-16). */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                rows: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "rows",
                    description: "returned rows, 2 API units each",
                    consumes: { credit: "default", amount: 2 },
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
        /** A fixed-shape snapshot is one row (the vendor bills all its
         *  returned fields as one row). */
        estimate: ({ data }) => {
            const rows = 1;
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
