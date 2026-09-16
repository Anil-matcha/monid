import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zOpointSuggestQueryParams } from "./schema/inputs.ts";

/**
 * `/suggest` — names to filter ids on the PUBLIC suggestion host. A
 * different product from the search API in every seam, so every provider
 * default is overridden here: host, auth (none), request shape (path
 * segments, not JSON), output (rows). The provider's `lifecycle.start`
 * still runs and relays this host's bodies verbatim (no `searchresult`
 * envelope to judge). FREE — v1 makePerCallPrice(0).
 */
export default defineEndpoint({
    meta: {
        displayName: "Resolve Filter Ids",
        summary:
            "Translate a country, site, language, or media name into a search filter id.",
        description: "Look up the numeric ids the news search filters " +
            "take: type a name or URL such as 'Norway', 'New York Post', " +
            "or 'bbc.co.uk' and get matching filters back. Returns rows of " +
            "type (lang, site, geo, media, content, topic, ent), id, name, " +
            "and site URL, best match first. Supports restricting to " +
            "chosen filter types and 1-20 rows. Free. Suited as the first " +
            "step before any filtered news search: use the row as " +
            "'type:id' inside a /search searchterm or as a filters[] entry " +
            "in /search-advanced.",
        docsUrl: "https://api-docs.opoint.com/references/suggestion-server",
        categories: ["news-search"],
    },
    /** PUBLIC identity (design D22): the native path carries derived
     *  {placeholders}, which the identity grammar forbids. */
    endpoint: "/suggest",
    auth: {
        /** Public server — the Search token must NOT travel to it (v1
         *  getProviderRuntime keyed a credential-less runtime on this
         *  path). The compiler requires every doc to resolve an inject, so
         *  this one returns the request untouched. */
        inject: ({ data }) => data.request,
    },
    /** Path segments (docs: references/suggestion-server): locale / mode /
     *  count / offsets / 0 / access_group / selected_filters / term.
     *  `access_group` 1 = public sites only: the "all" mask 2147483647
     *  also returns OTHER customers' custom sites (observed 2026-09-13).
     *  Sites Opoint adds for Monid under agreement §4.2 sit on Monid's own
     *  bit and will not appear until this value changes. */
    request: {
        method: "GET",
        path: "/suggest/en_GB_1/single/{limit}/{offsets}/0/1/nometa/{term}",
        baseUrl: "https://suggest.api.opoint.com",
    },
    input: {
        schema: { queryParams: zOpointSuggestQueryParams },
        /** Query → path segments. `types` becomes the per-type offset list
         *  (`geo:0,site:0`; `0` = all types); `limit` falls back to v1's
         *  5 (the server needs a count — not a vendor default). The engine
         *  percent-encodes each segment — verified 2026-09-15 against the
         *  live host: `geo%3A0%2Csite%3A0` answers exactly like the raw
         *  form. Nothing is left for the query string. v1 lineage:
         *  suggestPath. */
        toRequest: ({ data, utils }) => {
            const query = data.input.queryParams ?? {};
            const types = utils.json.optionalGet(query, "$.types");
            const offsets = Array.isArray(types)
                ? types.map((type) => String(type) + ":0").join(",")
                : "0";
            return {
                pathParams: {
                    limit: String(
                        utils.json.optionalNum(query, "$.limit") ?? 5,
                    ),
                    offsets,
                    term: String(utils.json.get(query, "$.query")),
                },
            };
        },
    },
    output: {
        /** Rows projected to `{type, id, name, url}` (v1
         *  projectSuggestResult) — the server's ranking internals (`mo`,
         *  `hl`, `weight`, `accessGroup`, …) are not part of the contract.
         *  A 2xx body without `results[]` relays verbatim (the host says
         *  e.g. `{"Error": "List type not found"}` on 200). */
        fromResponse: ({ data, utils }) => {
            const rows = utils.json.optionalGet(data.output, "$.results");
            if (!Array.isArray(rows)) return data.output;
            return {
                results: rows.map((row) =>
                    utils.json.pick(row, ["$.type", "$.id", "$.name", "$.url"])
                ),
            };
        },
    },
    /** FREE (design D25): the suggestion server is not metered by the
     *  agreement band (v1 makePerCallPrice(0), "Price stays USD 0"). */
    usage: { model: { kind: UsageModelKind.FREE } },
});
