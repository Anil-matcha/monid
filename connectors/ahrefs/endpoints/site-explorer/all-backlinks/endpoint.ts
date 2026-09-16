import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zAllBacklinksQueryParams } from "./schema/inputs.ts";

/**
 * GET /site-explorer/all-backlinks — the backlink index itself, one row per
 * link, 10 API units per row (the fixed field set below; design D4).
 */
export default defineEndpoint({
    meta: {
        displayName: "Backlinks",
        summary:
            "List a target's backlinks with anchors, source ratings, and link attributes.",
        description: "List the individual backlinks pointing at a domain or " +
            "URL, one row per link. Returns source and destination URLs, " +
            "anchor text, source page title, source Domain Rating and URL " +
            "Rating, first/last seen dates, dofollow flag, and link type. " +
            "Supports target scope (exact/prefix/domain/subdomains), " +
            "filtering and sorting on the returned fields, and a row budget " +
            "via limit. Suited for link audits, outreach prospecting, and " +
            "competitor link-profile analysis.",
        docsUrl: "https://docs.ahrefs.com/",
        categories: ["seo"],
        notes: [
            "Billing: 10 API units per returned row, minimum 50 units per " +
            "request — an empty result still draws 50.",
        ],
    },
    request: { method: "GET", path: "/site-explorer/all-backlinks" },
    input: {
        schema: {
            // `limit` REQUIRED at the binding (D25 — the estimate's whole
            // basis; the vendor's own default is 1,000 rows, ten times the
            // plan cap); `mode` / `protocol` carry the vendor's documented
            // defaults so the wire always states the scope (v1 parity).
            queryParams: zAllBacklinksQueryParams.extend({
                mode: zAllBacklinksQueryParams.shape.mode.unwrap().default(
                    "subdomains",
                ),
                protocol: zAllBacklinksQueryParams.shape.protocol.unwrap()
                    .default("both"),
            }).required({ limit: true }),
        },
        /** The fixed `select` (design D4) — callers never supply it; the
         *  same list `where` / `order_by` are restricted to. */
        toRequest: ({ data }) => ({
            ...data.input,
            queryParams: {
                ...data.input.queryParams,
                select: "url_from,url_to,anchor,title,domain_rating_source," +
                    "url_rating_source,first_seen,last_seen,is_dofollow," +
                    "link_type",
            },
        }),
    },
    usage: {
        /** The vendor formula `max(50, 10 × rows)` as two lines (design
         *  D1): rows at their per-row units, plus the top-up to the 50-unit
         *  request minimum. Both counts are the fns' job (D19).
         *  Rate card: 10 units/row = 10 × 1 — the field costs on
         *  https://docs.ahrefs.com/en/api/reference/site-explorer/get-all-backlinks
         *  (1 unit per field unless marked; checked 2026-09-16). */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                rows: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "rows",
                    description: "returned backlinks, 10 API units each",
                    consumes: { credit: "default", amount: 10 },
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
