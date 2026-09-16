import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zCrawledPagesQueryParams } from "./schema/inputs.ts";

/**
 * GET /site-explorer/crawled-pages — Crawled Pages: 6 API units per row (the fixed field set below; design D4).
 */
export default defineEndpoint({
    meta: {
        displayName: "Crawled Pages",
        summary:
            "List a target's pages known to the crawler with URL Rating and HTTP codes.",
        description:
            "List the target's pages present in the crawl index, one row " +
            "per page. Returns the URL, page title, URL Rating, HTTP code, " +
            "first seen date, and last crawl date. Supports target scope, " +
            "filtering, sorting, and a row budget via limit. Suited for " +
            "indexation checks and site-structure inventories.",
        docsUrl: "https://docs.ahrefs.com/",
        categories: ["seo"],
        notes: [
            "Billing: 6 API units per returned row, minimum 50 units per " +
            "request \u2014 an empty result still draws 50.",
            "where and order_by accept only this endpoint's returned " +
            "fields; anything else is rejected before the request.",
        ],
    },
    request: { method: "GET", path: "/site-explorer/crawled-pages" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the row budget is REQUIRED — the estimate's whole basis
            queryParams: zCrawledPagesQueryParams.extend({
                mode: zCrawledPagesQueryParams.shape.mode.unwrap().default(
                    "subdomains",
                ),
                protocol: zCrawledPagesQueryParams.shape.protocol.unwrap()
                    .default("both"),
            }).required({ limit: true }),
        },
        /** The fixed `select` (design D4) — callers never supply it. */
        toRequest: ({ data }) => ({
            ...data.input,
            queryParams: {
                ...data.input.queryParams,
                select:
                    "url,title,url_rating,http_code,first_seen,last_crawled",
            },
        }),
    },
    usage: {
        /** The vendor formula `max(50, 6 × rows)` as two lines (design
         *  D1): rows at their per-row units, plus the top-up to the 50-unit
         *  request minimum. Both counts are the fns' job (D19). */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                rows: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "rows",
                    description: "returned rows, 6 API units each",
                    consumes: { credit: "default", amount: 6 },
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
