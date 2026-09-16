import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zAiResponsesCountQueryParams } from "./schema/inputs.ts";

/**
 * GET /site-explorer/ai-responses-count — AI Answer Citations: 120 API units per row (the fixed field set below; design D4).
 */
export default defineEndpoint({
    meta: {
        displayName: "AI Answer Citations",
        summary:
            "Count how often eight AI assistants cite a target in generated answers.",
        description:
            "Count the answers in which each AI platform cites the target: " +
            "ChatGPT, Microsoft Copilot, Gemini, Google AI Mode, Google AI " +
            "Overviews (plus its keyword count), Grok, and Perplexity, in " +
            "one object. Supports an optional date and country filter and " +
            "target scope. Suited for AI-visibility (GEO) audits and share- " +
            "of-answer tracking.",
        docsUrl: "https://docs.ahrefs.com/",
        categories: ["geo"],
        notes: [
            "Billing: 120 API units per returned row, minimum 50 units per " +
            "billable request; cache hits and explicit zero consumption are free.",
        ],
    },
    request: { method: "GET", path: "/site-explorer/ai-responses-count" },
    input: {
        schema: {
            // vendor defaults at the binding (D25)
            queryParams: zAiResponsesCountQueryParams.extend({
                mode: zAiResponsesCountQueryParams.shape.mode.unwrap().default(
                    "subdomains",
                ),
                protocol: zAiResponsesCountQueryParams.shape.protocol.unwrap()
                    .default("both"),
            }),
        },
        /** The fixed `select` (design D4) — callers never supply it. */
        toRequest: ({ data }) => ({
            ...data.input,
            queryParams: {
                ...data.input.queryParams,
                select:
                    "chatgpt,copilot,gemini,google_ai_mode,google_ai_overviews," +
                    "google_ai_overviews_keywords,grok,perplexity",
            },
        }),
    },
    usage: {
        /** The vendor formula `max(50, 120 × rows)` as two lines (design
         *  D1): rows at their per-row units, plus the top-up to the 50-unit
         *  request minimum. Both counts are the fns' job (D19).
         *  Rate card: 120 units/row = chatgpt 15 + copilot 15 + gemini 15 +
         *  google_ai_mode 15 + google_ai_overviews 15 +
         *  google_ai_overviews_keywords 15 + grok 15 + perplexity 15 — the
         *  field costs on
         *  https://docs.ahrefs.com/en/api/reference/site-explorer/get-ai-responses-count
         *  (1 unit per field unless marked; checked 2026-09-16). */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                rows: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "rows",
                    description: "returned rows, 120 API units each",
                    consumes: { credit: "default", amount: 120 },
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
