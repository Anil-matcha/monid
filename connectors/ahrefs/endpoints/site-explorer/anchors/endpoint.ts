import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zAnchorsQueryParams } from "./schema/inputs.ts";

/**
 * GET /site-explorer/anchors — Backlink Anchors: 9 API units per row (the fixed field set below; design D4).
 */
export default defineEndpoint({
    meta: {
        displayName: "Backlink Anchors",
        summary:
            "Break down a target's backlinks by anchor text with referring-domain counts.",
        description:
            "Aggregate a target's backlinks by anchor text, one row per " +
            "distinct anchor. Returns the anchor, the number of unique " +
            "referring domains using it, total links to the target, and " +
            "first/last seen dates. Supports target scope, filtering, " +
            "sorting, and a row budget via limit. Suited for anchor-text " +
            "distribution audits and over-optimization checks.",
        docsUrl: "https://docs.ahrefs.com/",
        categories: ["seo"],
        notes: [
            "Billing: 9 API units per returned row, minimum 50 units per " +
            "request \u2014 an empty result still draws 50.",
            "where and order_by accept only this endpoint's returned " +
            "fields; anything else is rejected before the request.",
        ],
    },
    request: { method: "GET", path: "/site-explorer/anchors" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the row budget is REQUIRED — the estimate's whole basis
            queryParams: zAnchorsQueryParams.extend({
                mode: zAnchorsQueryParams.shape.mode.unwrap().default(
                    "subdomains",
                ),
                protocol: zAnchorsQueryParams.shape.protocol.unwrap().default(
                    "both",
                ),
            }).required({ limit: true }),
        },
        /** The fixed `select` (design D4) — callers never supply it. */
        toRequest: ({ data }) => ({
            ...data.input,
            queryParams: {
                ...data.input.queryParams,
                select:
                    "anchor,refdomains,links_to_target,first_seen,last_seen",
            },
        }),
    },
    usage: {
        /** The vendor formula `max(50, 9 × rows)` as two lines (design
         *  D1): rows at their per-row units, plus the top-up to the 50-unit
         *  request minimum. Both counts are the fns' job (D19). */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                rows: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "rows",
                    description: "returned rows, 9 API units each",
                    consumes: { credit: "default", amount: 9 },
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
        /** The requested row budget is the promise; the top-up follows
         *  from it and the doc's own per-row rate. */
        estimate: ({ data }) => {
            const rows = data.input.queryParams.limit;
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
