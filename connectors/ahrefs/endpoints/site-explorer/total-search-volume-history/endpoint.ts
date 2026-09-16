import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zTotalSearchVolumeHistoryQueryParams } from "./schema/inputs.ts";

/**
 * GET /site-explorer/total-search-volume-history — Search Volume History: 11 API units per row (all returned fields, one row).
 */
export default defineEndpoint({
    meta: {
        displayName: "Search Volume History",
        summary:
            "Track total search volume of keywords a target ranks for over time.",
        description:
            "Track the combined search volume of every keyword the target " +
            "ranks for between two dates. Returns the date and total search " +
            "volume per bucket. Supports target scope and an optional " +
            "country filter. Suited for demand-trend analysis of a site's " +
            "keyword footprint. One billed row per history_grouping bucket " +
            "(daily, weekly, or monthly).",
        docsUrl: "https://docs.ahrefs.com/",
        categories: ["seo"],
        notes: [
            "Billing: 11 API units per returned row, minimum 50 units per " +
            "request \u2014 an empty result still draws 50.",
            "Rows are date buckets between date_from and date_to; a range " +
            "may span at most 60 buckets upstream.",
        ],
    },
    request: {
        method: "GET",
        path: "/site-explorer/total-search-volume-history",
    },
    input: {
        schema: {
            // vendor defaults at the binding (D25); date_to is REQUIRED — the hold counts buckets and a hook fn has no clock (D6)
            queryParams: zTotalSearchVolumeHistoryQueryParams.extend({
                mode: zTotalSearchVolumeHistoryQueryParams.shape.mode.unwrap()
                    .default("subdomains"),
                protocol: zTotalSearchVolumeHistoryQueryParams.shape.protocol
                    .unwrap().default("both"),
                history_grouping: zTotalSearchVolumeHistoryQueryParams.shape
                    .history_grouping.unwrap()
                    .default("monthly"),
            }).required({ date_to: true }),
        },
    },
    usage: {
        /** The vendor formula `max(50, 11 × rows)` as two lines (design
         *  D1): rows at their per-row units, plus the top-up to the 50-unit
         *  request minimum. Both counts are the fns' job (D19). */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                rows: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "rows",
                    description: "returned rows, 11 API units each",
                    consumes: { credit: "default", amount: 11 },
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
        /** One row per date bucket of the requested range (design D6). Hook
         *  fns have no `Date`, so the day count is pure arithmetic
         *  (days-from-civil) over the two required YYYY-MM-DD strings;
         *  weekly / monthly buckets are ceil(days / 7) and ceil(days / 30)
         *  — the settle trues up to the rows the vendor returns. */
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
            const span = Math.max(
                1,
                days(query.date_to) - days(query.date_from) + 1,
            );
            const grouping = query.history_grouping;
            const rows = grouping === "daily"
                ? span
                : grouping === "weekly"
                ? Math.ceil(span / 7)
                : Math.ceil(span / 30);
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
