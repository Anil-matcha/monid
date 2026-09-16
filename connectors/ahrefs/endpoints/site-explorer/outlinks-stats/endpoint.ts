import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zOutlinksStatsQueryParams } from "./schema/inputs.ts";

/**
 * GET /site-explorer/outlinks-stats — Outbound Link Totals: 4 API units per row (all returned fields, one row).
 */
export default defineEndpoint({
    meta: {
        displayName: "Outbound Link Totals",
        summary:
            "Get a target's outbound link totals: external, internal, and dofollow counts.",
        description:
            "Get the outgoing-link totals for a target in one object: " +
            "external and internal link counts and their dofollow subsets. " +
            "Supports target scope and protocol. Suited for a quick " +
            "outbound-profile check before pulling row-level outgoing " +
            "reports.",
        docsUrl: "https://docs.ahrefs.com/",
        categories: ["seo"],
        notes: [
            "Billing: 4 API units per returned row, minimum 50 units per " +
            "billable request; cache hits and explicit zero consumption are free.",
        ],
    },
    request: { method: "GET", path: "/site-explorer/outlinks-stats" },
    input: {
        schema: {
            // vendor defaults at the binding (D25)
            queryParams: zOutlinksStatsQueryParams.extend({
                mode: zOutlinksStatsQueryParams.shape.mode.unwrap().default(
                    "subdomains",
                ),
                protocol: zOutlinksStatsQueryParams.shape.protocol.unwrap()
                    .default("both"),
            }),
        },
    },
    usage: {
        /** The vendor formula `max(50, 4 × rows)` as two lines (design
         *  D1): rows at their per-row units, plus the top-up to the 50-unit
         *  request minimum. Both counts are the fns' job (D19).
         *  Rate card: 4 units/row = all returned fields, 4 × 1 — the field
         *  costs on
         *  https://docs.ahrefs.com/en/api/reference/site-explorer/get-outlinks-stats
         *  (1 unit per field unless marked; checked 2026-09-16). */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                rows: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "rows",
                    description: "returned rows, 4 API units each",
                    consumes: { credit: "default", amount: 4 },
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
