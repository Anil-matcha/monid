import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zMatchingTermsQueryParams } from "./schema/inputs.ts";

/**
 * GET /keywords-explorer/matching-terms — Matching Keywords: 22 API units per row (the fixed field set below; design D4).
 */
export default defineEndpoint({
    meta: {
        displayName: "Matching Keywords",
        summary:
            "Find keyword ideas containing seed terms, with volume and difficulty.",
        description:
            "Expand seed keywords into ideas that CONTAIN the seed terms, " +
            "one row per idea. Returns the keyword, search volume, keyword " +
            "difficulty, and CPC. Supports filtering and sorting on the " +
            "returned fields and a row budget via limit. Suited for " +
            "building keyword lists around a topic.",
        docsUrl: "https://docs.ahrefs.com/",
        categories: ["seo"],
        notes: [
            "Billing: 22 API units per returned row, minimum 50 units per " +
            "request \u2014 an empty result still draws 50.",
            "where and order_by accept only this endpoint's returned " +
            "fields; anything else is rejected before the request.",
        ],
    },
    request: { method: "GET", path: "/keywords-explorer/matching-terms" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the row budget is REQUIRED — the estimate's whole basis
            queryParams: zMatchingTermsQueryParams.required({ limit: true }),
        },
        /** The fixed `select` (design D4) — callers never supply it; `keywords` joins onto the vendor's comma-separated parameter (the engine would otherwise repeat the key). */
        toRequest: ({ data }) => ({
            ...data.input,
            queryParams: {
                // every array leaf joins onto a comma-separated value (the
                // akta CSV posture) — `keywords` is the one this vendor has
                ...Object.fromEntries(
                    Object.entries(data.input.queryParams ?? {}).map((
                        [key, value],
                    ) => [key, Array.isArray(value) ? value.join(",") : value]),
                ),
                select: "keyword,volume,difficulty,cpc",
            },
        }),
    },
    usage: {
        /** The vendor formula `max(50, 22 × rows)` as two lines (design
         *  D1): rows at their per-row units, plus the top-up to the 50-unit
         *  request minimum. Both counts are the fns' job (D19). */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                rows: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "rows",
                    description: "returned rows, 22 API units each",
                    consumes: { credit: "default", amount: 22 },
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
