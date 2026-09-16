import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zPagesByTrafficQueryParams } from "./schema/inputs.ts";

/**
 * GET /site-explorer/pages-by-traffic — Traffic Distribution: 56 API units per row (all returned fields, one row).
 */
export default defineEndpoint({
    meta: {
        displayName: "Traffic Distribution",
        summary:
            "Bucket a target's pages into organic-traffic ranges with totals per range.",
        description:
            "Get the distribution of a target's pages across organic " +
            "traffic ranges (1-100, 101-1K, 1K-5K, 5K-10K, 10K+) in one " +
            "object: page counts and total traffic per range. Supports " +
            "target scope and an optional country filter. Suited for sizing " +
            "where a site's traffic concentrates.",
        docsUrl: "https://docs.ahrefs.com/",
        categories: ["seo"],
        notes: [
            "Billing: 56 API units per returned row, minimum 50 units per " +
            "billable request; cache hits and explicit zero consumption are free.",
        ],
    },
    request: { method: "GET", path: "/site-explorer/pages-by-traffic" },
    input: {
        schema: {
            // vendor defaults at the binding (D25)
            queryParams: zPagesByTrafficQueryParams.extend({
                mode: zPagesByTrafficQueryParams.shape.mode.unwrap().default(
                    "subdomains",
                ),
                protocol: zPagesByTrafficQueryParams.shape.protocol.unwrap()
                    .default("both"),
            }),
        },
    },
    usage: {
        /** The vendor formula `max(50, 56 × rows)` as two lines (design
         *  D1): rows at their per-row units, plus the top-up to the 50-unit
         *  request minimum. Both counts are the fns' job (D19).
         *  Rate card: 56 units/row = all returned fields, 6 × 1 +
         *  range100_traffic 10 + range10k_plus_traffic 10 + range10k_traffic
         *  10 + range1k_traffic 10 + range5k_traffic 10 — the field costs on
         *  https://docs.ahrefs.com/en/api/reference/site-explorer/get-pages-by-traffic
         *  (1 unit per field unless marked; checked 2026-09-16). */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                rows: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "rows",
                    description: "returned rows, 56 API units each",
                    consumes: { credit: "default", amount: 56 },
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
