import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zSearchRunBody, zSearchRunPathParams } from "./schema/inputs.ts";

/**
 * `POST /search/query-mode/{search_id}/run` — page the forward-only
 * iterator created by the create-advanced-search endpoint.
 *
 * PUBLIC identity is pinned brace-free (`zEndpointPath` admits no
 * placeholders, design D9): `/search/query-mode/run`, the v1 id verbatim.
 * v1 carried `search_id` in the BODY and mapped it onto the path inside a
 * lifecycle hook; here it is a first-class validated `pathParams` slot
 * (fundable's `/deal` precedent) — the engine substitutes and URI-encodes
 * it, and the doc's compiled url shows where the field goes.
 */
export default defineEndpoint({
    meta: {
        displayName: "Fetch Advanced Search Results",
        summary:
            "Fetch the next page of results for an advanced search by search_id.",
        description: "Pages the results of a created advanced search: " +
            "pass the search_id and a limit (1-500) to pull the next " +
            "page. Returns data rows (people: clay_profile_id, name, " +
            "location, matched experiences; companies: domain, industry, " +
            "size, annual_revenue, funding, linkedin_url), has_more, " +
            "source_type, and period_quota (the subscription's annual " +
            "results ledger). The iterator is forward-only and " +
            "server-side — repeat while has_more is true. Suited for " +
            "pulling prospect and account lists page by page.",
        docsUrl: "https://developers.clay.com/searches/advanced",
        categories: ["people-enrichment", "company-enrichment"],
        /** The two facts that cost a caller something if unknown: what is
         *  actually metered (rows returned, not the limit asked for), and
         *  that the handle dies rather than degrading. */
        notes: [
            "Rows draw the subscription's annual results quota one for " +
            "one, counted on rows RETURNED rather than the limit " +
            "requested — a short final page draws less than it promised. " +
            "Past the annual cap Clay answers HTTP 402.",

            "Searches expire upstream. A 404 'Search not found or " +
            "expired' means the handle is dead — create a new search " +
            "rather than retrying this one. An exhausted iterator is " +
            "different: it returns an empty page and draws nothing.",
        ],
    },
    endpoint: "/search/query-mode/run",
    request: { method: "POST", path: "/search/query-mode/{search_id}/run" },
    // `limit` REQUIRED at the binding (design D25 — the mirror stays the
    // faithful vendor contract, optional with server default 20): it is the
    // estimate's whole basis, so the caller states the cap. The 1-500
    // bounds are the vendor's own.
    input: {
        schema: {
            pathParams: zSearchRunPathParams,
            body: zSearchRunBody.required({ limit: true }),
        },
    },
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
        /** One row = one draw on the annual results quota (design D26).
         *  Clay's own quota meter counts ROWS RETURNED, not the requested
         *  limit — drill-verified against `period_quota.used`. v1 priced
         *  rows at an authored $0.001 to gate the shared quota; that was a
         *  platform decision and has no home in a doc — the pool is the
         *  quota itself, and the broker prices it. */
        model: {
            kind: UsageModelKind.PER_UNIT,
            unit: Unit.RESULT,
            label: "rows",
            description: "result rows returned by this page",
            consumes: { credit: "search_result", amount: 1 },
        },
        /** The caller-stated limit IS the row promise, and actual rows are
         *  always ≤ it, so the hold always covers the draw (typed read of
         *  the pre-toRequest validated input — design D25). */
        estimate: ({ data }) => ({
            counts: { "RESULT": data.input.body.limit },
        }),
        /** Settle counts the rows Clay actually returned (v1
         *  extractBilledUnits' search-page arm: `data.length`). An empty
         *  or expired iterator returns `data: []` — 0 rows, 0 draw. */
        evidence: ({ data, utils }) => ({
            counts: {
                "RESULT": utils.json.optionalLen(data.output, "$.data") ?? 0,
            },
        }),
    },
});
