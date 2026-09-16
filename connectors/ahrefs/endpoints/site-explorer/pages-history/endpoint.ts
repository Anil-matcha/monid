import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zPagesHistoryQueryParams } from "./schema/inputs.ts";

/**
 * GET /site-explorer/pages-history — Ranking Pages History: 2 API units per row (all returned fields, one row).
 */
export default defineEndpoint({
    meta: {
        displayName: "Ranking Pages History",
        summary:
            "Track how many of a target's pages rank in organic search over time.",
        description:
            "Track the number of the target's pages ranking in organic " +
            "search between two dates. Returns the date and ranking-page " +
            "count per bucket. Supports target scope and an optional " +
            "country filter. Suited for content-footprint trend analysis. " +
            "One billed row per history_grouping bucket (daily, weekly, or " +
            "monthly).",
        docsUrl: "https://docs.ahrefs.com/",
        categories: ["seo"],
        notes: [
            "Billing: 2 API units per returned row, minimum 50 units per " +
            "request \u2014 an empty result still draws 50.",
            "Rows are date buckets between date_from and date_to; a range " +
            "may span at most 60 buckets upstream.",
        ],
    },
    request: { method: "GET", path: "/site-explorer/pages-history" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); date_to is REQUIRED — the hold counts buckets and a hook fn has no clock (D6)
            queryParams: zPagesHistoryQueryParams.extend({
                mode: zPagesHistoryQueryParams.shape.mode.unwrap().default(
                    "subdomains",
                ),
                protocol: zPagesHistoryQueryParams.shape.protocol.unwrap()
                    .default("both"),
                history_grouping: zPagesHistoryQueryParams.shape
                    .history_grouping.unwrap()
                    .default("monthly"),
            }).required({ date_to: true }),
        },
    },
    usage: {
        /** The vendor formula `max(50, 2 × rows)` as two lines (design
         *  D1): rows at their per-row units, plus the top-up to the 50-unit
         *  request minimum. Both counts are the fns' job (D19).
         *  Rate card: 2 units/row = all returned fields, 2 × 1 — the field
         *  costs on
         *  https://docs.ahrefs.com/en/api/reference/site-explorer/get-pages-history
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
        /** One row per bucket ANCHOR inside the requested range (design
         *  D6; live-measured 2026-09-16): daily rows carry every day,
         *  weekly rows are dated on Mondays, monthly rows on the 1st, so
         *  the count is the anchors in [date_from, date_to] — not the span
         *  divided by a bucket width, which under-holds a 1st-to-1st span
         *  in a short month. Hook fns have no `Date`, so the day number is
         *  pure arithmetic (days-from-civil) over the two required
         *  YYYY-MM-DD strings; the settle trues up to the rows returned. */
        estimate: ({ data }) => {
            const query = data.input.queryParams;
            const days = (iso: string): number => {
                const y = Number(iso.slice(0, 4));
                const m = Number(iso.slice(5, 7));
                const d = Number(iso.slice(8, 10));
                const shifted = m <= 2 ? y - 1 : y;
                const era = Math.floor(shifted / 400);
                const yearOfEra = shifted - era * 400;
                const monthIndex = (m + 9) % 12;
                const dayOfYear = Math.floor((153 * monthIndex + 2) / 5) + d -
                    1;
                const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) -
                    Math.floor(yearOfEra / 100) + dayOfYear;
                return era * 146097 + dayOfEra;
            };
            const monthOf = (iso: string): number =>
                Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7));
            const from = days(query.date_from);
            const to = days(query.date_to);
            // the first 1st-of-month at or after date_from
            const firstMonth = monthOf(query.date_from) +
                (Number(query.date_from.slice(8, 10)) > 1 ? 1 : 0);
            // 1970-01-05, a Monday, on the day scale above
            const monday = 719472;
            const grouping = query.history_grouping;
            const rows = to < from
                ? 0
                : grouping === "daily"
                ? to - from + 1
                : grouping === "weekly"
                ? Math.floor((to - monday) / 7) -
                    Math.floor((from - 1 - monday) / 7)
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
