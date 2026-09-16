import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zLinkedAnchorsExternalQueryParams } from "./schema/inputs.ts";

/**
 * GET /site-explorer/linked-anchors-external — Outbound Anchors: 5 API units per row (the fixed field set below; design D4).
 */
export default defineEndpoint({
    meta: {
        displayName: "Outbound Anchors",
        summary:
            "Break down a target's outbound external links by anchor text.",
        description:
            "Aggregate the target's outbound external links by anchor text, " +
            "one row per distinct anchor. Returns the anchor, the number of " +
            "links from the target using it, and the linked domain and page " +
            "counts with first seen date. Supports target scope, filtering, " +
            "sorting, and a row budget via limit. Suited for outbound " +
            "anchor audits.",
        docsUrl: "https://docs.ahrefs.com/",
        categories: ["seo"],
        notes: [
            "Billing: 5 API units per returned row, minimum 50 units per " +
            "billable request; cache hits and explicit zero consumption are free.",
            "where and order_by accept only this endpoint's returned " +
            "fields; anything else is rejected before the request.",
        ],
    },
    request: { method: "GET", path: "/site-explorer/linked-anchors-external" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the row budget is REQUIRED — the estimate's whole basis
            queryParams: zLinkedAnchorsExternalQueryParams.extend({
                mode: zLinkedAnchorsExternalQueryParams.shape.mode.unwrap()
                    .default("subdomains"),
                protocol: zLinkedAnchorsExternalQueryParams.shape.protocol
                    .unwrap().default("both"),
            }).required({ limit: true }),
        },
        /** The fixed `select` (design D4) — callers never supply it. */
        toRequest: ({ data }) => ({
            ...data.input,
            queryParams: {
                ...data.input.queryParams,
                select:
                    "anchor,links_from_target,linked_domains,linked_pages," +
                    "first_seen",
            },
        }),
    },
    usage: {
        /** The vendor formula `max(50, 5 × rows)` as two lines (design
         *  D1): rows at their per-row units, plus the top-up to the 50-unit
         *  request minimum. Both counts are the fns' job (D19).
         *  Rate card: 5 units/row = 5 × 1 — the field costs on
         *  https://docs.ahrefs.com/en/api/reference/site-explorer/get-linked-anchors-external
         *  (1 unit per field unless marked; checked 2026-09-16). */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                rows: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "rows",
                    description: "returned rows, 5 API units each",
                    consumes: { credit: "default", amount: 5 },
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
