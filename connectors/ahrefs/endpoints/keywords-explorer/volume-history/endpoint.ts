import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zVolumeHistoryQueryParams } from "./schema/inputs.ts";

/**
 * GET /keywords-explorer/volume-history — Keyword Volume History: 2 API units per row (all returned fields, one row).
 */
export default defineEndpoint({
    meta: {
        displayName: "Keyword Volume History",
        summary:
            "Track a keyword's monthly search volume over time in one country.",
        description:
            "Track a keyword's search volume month by month between two " +
            "dates in one country. Returns the date and volume per month, " +
            "one billed row each. Suited for seasonality and demand-trend " +
            "analysis.",
        docsUrl: "https://docs.ahrefs.com/",
        categories: ["seo"],
        notes: [
            "Billing: 2 API units per returned row, minimum 50 units per " +
            "request \u2014 an empty result still draws 50.",
            "Rows are date buckets between date_from and date_to; a range " +
            "may span at most 60 buckets upstream.",
        ],
    },
    request: { method: "GET", path: "/keywords-explorer/volume-history" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); date_to is REQUIRED — the hold counts buckets and a hook fn has no clock (D6)
            queryParams: zVolumeHistoryQueryParams.required({ date_to: true }),
        },
    },
    usage: {
        /** The vendor formula `max(50, 2 × rows)` as two lines (design
         *  D1): rows at their per-row units, plus the top-up to the 50-unit
         *  request minimum. Both counts are the fns' job (D19).
         *  Rate card: 2 units/row = all returned fields, 2 × 1 — the field
         *  costs on
         *  https://docs.ahrefs.com/en/api/reference/keywords-explorer/get-volume-history
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
                        "units added to reach the 50-unit per-request minimum (drawn even on an empty result)",
                    consumes: { credit: "default", amount: 1 },
                },
            },
        },
        /** One row per MONTH ANCHOR inside the requested range (design D6;
         *  live-measured 2026-09-16): monthly rows are dated on the 1st, so
         *  the count is the 1sts in [date_from, date_to] — not the span
         *  divided by 30, which under-holds a 1st-to-1st span in a short
         *  month. Pure arithmetic over the two required YYYY-MM-DD strings
         *  (hook fns have no `Date`); the settle trues up to the rows
         *  returned. */
        estimate: ({ data }) => {
            const query = data.input.queryParams;
            const monthOf = (iso: string): number =>
                Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7));
            // the first 1st-of-month at or after date_from
            const firstMonth = monthOf(query.date_from) +
                (Number(query.date_from.slice(8, 10)) > 1 ? 1 : 0);
            const rows = query.date_to < query.date_from
                ? 0
                : Math.max(0, monthOf(query.date_to) - firstMonth + 1);
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
