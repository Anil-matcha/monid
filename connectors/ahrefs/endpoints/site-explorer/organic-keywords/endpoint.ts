import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zOrganicKeywordsQueryParams } from "./schema/inputs.ts";

/**
 * GET /site-explorer/organic-keywords — Organic Keywords: 24 API units per row (the fixed field set below; design D4).
 */
export default defineEndpoint({
    meta: {
        displayName: "Organic Keywords",
        summary:
            "List keywords a target ranks for with position, volume, and traffic estimates.",
        description:
            "List the organic keywords a domain or URL ranks for, one row " +
            "per keyword. Returns the keyword, best position, ranking URL, " +
            "search volume, estimated monthly traffic, and CPC. Supports a " +
            "report date, country filter, target scope, filtering and " +
            "sorting on the returned fields, and a row budget via limit. " +
            "Suited for competitor keyword research and rank tracking " +
            "snapshots.",
        docsUrl: "https://docs.ahrefs.com/",
        categories: ["seo"],
        notes: [
            "Billing: 24 API units per returned row, minimum 50 units per " +
            "request \u2014 an empty result still draws 50.",
            "where and order_by accept only this endpoint's returned " +
            "fields; anything else is rejected before the request.",
        ],
    },
    request: { method: "GET", path: "/site-explorer/organic-keywords" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the row budget is REQUIRED — the estimate's whole basis
            queryParams: zOrganicKeywordsQueryParams.extend({
                mode: zOrganicKeywordsQueryParams.shape.mode.unwrap().default(
                    "subdomains",
                ),
                protocol: zOrganicKeywordsQueryParams.shape.protocol.unwrap()
                    .default("both"),
            }).required({ limit: true }),
        },
        /** The fixed `select` (design D4) — callers never supply it. */
        toRequest: ({ data }) => ({
            ...data.input,
            queryParams: {
                ...data.input.queryParams,
                select: "keyword,best_position,best_position_url,volume," +
                    "sum_traffic,cpc",
            },
        }),
    },
    usage: {
        /** The vendor formula `max(50, 24 × rows)` as two lines (design
         *  D1): rows at their per-row units, plus the top-up to the 50-unit
         *  request minimum. Both counts are the fns' job (D19).
         *  Rate card: 24 units/row = 4 × 1 + volume 10 + sum_traffic 10 — the
         *  field costs on
         *  https://docs.ahrefs.com/en/api/reference/site-explorer/get-organic-keywords
         *  (1 unit per field unless marked; checked 2026-09-16). */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                rows: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "rows",
                    description: "returned rows, 24 API units each",
                    consumes: { credit: "default", amount: 24 },
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
