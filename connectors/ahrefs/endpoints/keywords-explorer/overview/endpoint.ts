import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zOverviewQueryParams } from "./schema/inputs.ts";

/**
 * GET /keywords-explorer/overview — Keyword Metrics: 42 API units per row (the fixed field set below; design D4).
 */
export default defineEndpoint({
    meta: {
        displayName: "Keyword Metrics",
        summary:
            "Get volume, difficulty, traffic potential, intent, and CPC for up to 100 keywords.",
        description:
            "Get the full metric bundle for a list of keywords in one " +
            "country, one row per keyword. Returns search volume, keyword " +
            "difficulty, traffic potential of the top-ranking page, search " +
            "intents, and CPC. Suited for keyword shortlisting, difficulty " +
            "triage, and content prioritization.",
        docsUrl: "https://docs.ahrefs.com/",
        categories: ["seo"],
        notes: [
            "Billing: 42 API units per returned row, minimum 50 units per " +
            "billable request; cache hits and explicit zero consumption are free.",
        ],
    },
    request: { method: "GET", path: "/keywords-explorer/overview" },
    input: {
        schema: {
            // vendor defaults at the binding (D25)
            queryParams: zOverviewQueryParams,
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
                select:
                    "keyword,volume,difficulty,traffic_potential,intents,cpc",
            },
        }),
    },
    usage: {
        /** The vendor formula `max(50, 42 × rows)` as two lines (design
         *  D1): rows at their per-row units, plus the top-up to the 50-unit
         *  request minimum. Both counts are the fns' job (D19).
         *  Rate card: 42 units/row = 2 × 1 + volume 10 + difficulty 10 +
         *  traffic_potential 10 + intents 10 — the field costs on
         *  https://docs.ahrefs.com/en/api/reference/keywords-explorer/get-overview
         *  (1 unit per field unless marked; checked 2026-09-16). */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                rows: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "rows",
                    description: "returned rows, 42 API units each",
                    consumes: { credit: "default", amount: 42 },
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
        /** One row per requested keyword. */
        estimate: ({ data }) => {
            const rows = data.input.queryParams.keywords.length;
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
