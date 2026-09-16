import { defineEndpoint, UsageModelKind } from "@shared/core";

/**
 * `GET /search/query-mode/reference` — the query-language reference
 * document. Free, and the first step of the three-call search flow:
 * reference → create → run.
 *
 * The provider's lifecycle is routine-shaped (it wraps the body in
 * `items`), so this doc overrides `start` with a plain relay and inherits
 * a `poll` that can never fire: `lifecycle.poll` only resolves when a
 * `start` does.
 */
export default defineEndpoint({
    meta: {
        displayName: "Get Search Query Reference",
        summary:
            "Fetch the query-language reference for authoring advanced people/company searches.",
        description: "Returns the full reference document (markdown) for " +
            "the advanced search query language: the queryable field " +
            "catalog for people and companies, operators " +
            "(is_similar_to, comparisons, Boolean grouping), and " +
            "cross-entity patterns (experiences.any, people.exists, " +
            "technographics). Fetch it before writing a query, then " +
            "create the search with the create-advanced-search endpoint " +
            "and page the rows with the fetch-results endpoint. Free. " +
            "Suited for agents authoring precise prospect or account " +
            "searches.",
        docsUrl: "https://developers.clay.com/searches/advanced",
        categories: ["people-enrichment", "company-enrichment"],
    },
    request: { method: "GET", path: "/search/query-mode/reference" },
    lifecycle: {
        /** Plain relay — the sync shape the engine would run declaratively
         *  (see the doc comment above). Identical source across the three
         *  search docs, so the compiler interns ONE fnTable entry. */
        start: async ({ utils }) => {
            const res = await utils.request();
            return {
                kind: "COMPLETED",
                httpStatus: res.status,
                output: res.body,
            };
        },
    },
    usage: {
        /** FREE (design D26): reading the grammar draws nothing from any
         *  of Clay's three pools — no data credits, no actions, no
         *  search-results quota (drill-verified). The MODEL alone says
         *  so: the quantities fns are compiler-synthesized. */
        model: { kind: UsageModelKind.FREE },
    },
});
