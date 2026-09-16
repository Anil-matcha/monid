import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zBacklinksStatsQueryParams } from "./schema/inputs.ts";

/**
 * GET /site-explorer/backlinks-stats — Backlink Totals: 12 API units per row (all returned fields, one row).
 */
export default defineEndpoint({
    meta: {
        displayName: "Backlink Totals",
        summary:
            "Get a target's live and all-time backlink and referring-domain totals.",
        description:
            "Get the backlink-profile totals for a domain or URL in one " +
            "object: live backlinks, all-time backlinks, live referring " +
            "domains, and all-time referring domains as of the given date. " +
            "Supports target scope and protocol. Suited for a quick link- " +
            "profile size check before pulling row-level reports.",
        docsUrl: "https://docs.ahrefs.com/",
        categories: ["seo"],
        notes: [
            "Billing: 12 API units per returned row, minimum 50 units per " +
            "request \u2014 an empty result still draws 50.",
        ],
    },
    request: { method: "GET", path: "/site-explorer/backlinks-stats" },
    input: {
        schema: {
            // vendor defaults at the binding (D25)
            queryParams: zBacklinksStatsQueryParams.extend({
                mode: zBacklinksStatsQueryParams.shape.mode.unwrap().default(
                    "subdomains",
                ),
                protocol: zBacklinksStatsQueryParams.shape.protocol.unwrap()
                    .default("both"),
            }),
        },
    },
    usage: {
        /** The vendor formula `max(50, 12 × rows)` as two lines (design
         *  D1): rows at their per-row units, plus the top-up to the 50-unit
         *  request minimum. Both counts are the fns' job (D19). */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                rows: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "rows",
                    description: "returned rows, 12 API units each",
                    consumes: { credit: "default", amount: 12 },
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
