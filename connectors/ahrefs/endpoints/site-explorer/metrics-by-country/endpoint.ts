import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zMetricsByCountryQueryParams } from "./schema/inputs.ts";

/**
 * GET /site-explorer/metrics-by-country — Metrics by Country: 23 API units per row (the fixed field set below; design D4).
 */
export default defineEndpoint({
    meta: {
        displayName: "Metrics by Country",
        summary:
            "Split a target's organic and paid keywords and traffic by country.",
        description:
            "Split a target's search metrics by country, one row per " +
            "country with data. Returns the country code, organic keywords, " +
            "estimated organic traffic, paid keywords, and paid traffic as " +
            "of the given date. Supports target scope. Suited for " +
            "international SEO prioritization. Returns every country with " +
            "data (no row budget), so the hold assumes the full country " +
            "list.",
        docsUrl: "https://docs.ahrefs.com/",
        categories: ["seo"],
        notes: [
            "Billing: 23 API units per returned row, minimum 50 units per " +
            "billable request; cache hits and explicit zero consumption are free.",
            "Returns every country with data (no row budget); the hold " +
            "assumes up to 250 rows.",
        ],
    },
    request: { method: "GET", path: "/site-explorer/metrics-by-country" },
    input: {
        schema: {
            // vendor defaults at the binding (D25)
            queryParams: zMetricsByCountryQueryParams.extend({
                mode: zMetricsByCountryQueryParams.shape.mode.unwrap().default(
                    "subdomains",
                ),
                protocol: zMetricsByCountryQueryParams.shape.protocol.unwrap()
                    .default("both"),
            }),
        },
        /** The fixed `select` (design D4) — callers never supply it. */
        toRequest: ({ data }) => ({
            ...data.input,
            queryParams: {
                ...data.input.queryParams,
                select: "country,org_keywords,org_traffic,paid_keywords," +
                    "paid_traffic",
            },
        }),
    },
    usage: {
        /** The vendor formula `max(50, 23 × rows)` as two lines (design
         *  D1): rows at their per-row units, plus the top-up to the 50-unit
         *  request minimum. Both counts are the fns' job (D19).
         *  Rate card: 23 units/row = 3 × 1 + org_traffic 10 + paid_traffic 10
         *  — the field costs on
         *  https://docs.ahrefs.com/en/api/reference/site-explorer/get-metrics-by-country
         *  (1 unit per field unless marked; checked 2026-09-16). */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                rows: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "rows",
                    description: "returned rows, 23 API units each",
                    consumes: { credit: "default", amount: 23 },
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
        /** No row budget upstream: one row per country with data, so the
         *  hold assumes the full country list — 250 is DEDUCED from the
         *  vendor (about 230 countries carry data). */
        estimate: ({ data }) => {
            const rows = 250;
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
