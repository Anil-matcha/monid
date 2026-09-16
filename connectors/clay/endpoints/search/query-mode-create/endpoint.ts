import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zSearchCreateBody } from "./schema/inputs.ts";

/**
 * `POST /search/query-mode` — create a server-side search and get its
 * `search_id`. Free: creating draws nothing; only the rows the run
 * endpoint returns touch the annual quota (drill-verified).
 *
 * (Clay's filters-mode search is deprecated upstream in favour of
 * query-mode and is not exposed.)
 */
export default defineEndpoint({
    meta: {
        displayName: "Create Advanced Search",
        summary:
            "Start an advanced-query search for people or companies and get a search_id.",
        description: "Creates a server-side search over Clay's " +
            "proprietary GTM database from one advanced-query string with " +
            "cross-entity filters and nested Boolean logic (e.g. current " +
            "VP Sales at 500+-employee Software Development companies " +
            "using Salesforce). Returns a search_id and the detected " +
            "source_type (people or companies) — no rows yet; page them " +
            "with the fetch-results endpoint, passing the search_id. " +
            "Look up the field catalog and grammar first with the " +
            "query-reference endpoint. Creating is free; only returned " +
            "rows draw the annual results quota. Suited for precise " +
            "prospect-list and account-list building.",
        docsUrl: "https://developers.clay.com/searches/advanced",
        categories: ["people-enrichment", "company-enrichment"],
    },
    request: { method: "POST", path: "/search/query-mode" },
    input: { schema: { body: zSearchCreateBody } },
    lifecycle: {
        /** Plain relay — see query-mode-reference. Same source, one
         *  interned fnTable entry. */
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
        /** FREE (design D26): creating a search draws nothing — no data
         *  credits, no actions, and no quota rows until the iterator is
         *  paged (drill-verified). */
        model: { kind: UsageModelKind.FREE },
    },
});
