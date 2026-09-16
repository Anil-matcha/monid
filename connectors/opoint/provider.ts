import { defineProvider } from "@shared/core";

/**
 * Opoint (opoint.com) — global news monitoring. Two hosts behind one
 * connector, exactly as v1 (`adaptors/opoint`):
 *
 *   - **Search** (`POST https://api.opoint.com/search/`, `Authorization:
 *     Token …`): four article-search docs that differ only in the wire
 *     profile layered under the caller's `params`. Everything they share
 *     lives HERE (leaf-wise fallback): the token header, the article
 *     profile `toRequest`, the in-band failure verdict in `lifecycle.start`,
 *     and the agreement-bound article projection in `fromResponse`.
 *   - **Suggestion server** (`GET https://suggest.api.opoint.com/…`, no
 *     auth): `/suggest` overrides every one of those seams — different
 *     host, no credential, path-built request, row-shaped output.
 *
 * Billing: Opoint sells a monthly band of Search API calls (10,000 for the
 * current agreement; usage endpoint `totals.requests`) and puts no meter
 * in any response. So the pool is CALLS, drawn 1 per search request, with
 * no `consolidate` (nothing to claim, nothing to strip). v1 amortized the
 * band to USD 0.06/call — that is a contract-price conversion, which stays
 * on the broker card (pool rule, 2026-09-15). Suggestion lookups are FREE.
 */
export default defineProvider({
    name: "opoint",
    meta: {
        displayName: "Opoint",
        summary:
            "Global news search: articles and headlines from 200+ countries.",
        description: "Global news monitoring for agents — search articles " +
            "and headlines across 200+ countries with expression syntax " +
            "and filter ids (language, country, site, media type), fetch " +
            "known articles by id, and resolve names to filter ids. Each " +
            "article returns its headline, author, publication time, " +
            "original URL, site metadata, readership estimates, and a " +
            "256-character snippet.",
        homepageUrl: "https://www.opoint.com",
        docsUrl: "https://api-docs.opoint.com",
        categories: ["news-search"],
    },
    auth: {
        /** Opoint is Django REST framework TokenAuthentication:
         *  `Authorization: Token <key>` — neither `presets.auth.header`
         *  (bare value) nor `presets.auth.bearer` ("Bearer ") produces
         *  it, so the inject is spelled inline (owner call, 2026-09-15:
         *  inline over a new preset). v1 lineage: getProviderRuntime's
         *  `Authorization: Token ${apiToken}`. */
        inject: ({ data }) => ({
            ...data.request,
            headers: {
                ...data.request.headers,
                Authorization: "Token " + data.params.apiKey,
            },
        }),
    },
    request: {
        baseUrl: "https://api.opoint.com",
        /** Opoint is Django REST framework: without an explicit Accept it
         *  content-negotiates to the BROWSABLE API — an HTTP 200 HTML page
         *  with the result embedded as XML (observed 2026-09-16 with a
         *  valid token). v1's httpProviderRuntime always sent this header;
         *  the engine does not, so the provider pins it (bytedance
         *  precedent). Reaches `/suggest` too — harmless on that host. */
        headers: { Accept: "application/json" },
    },
    // mirrors services/workflows/endpointExecution/config.yml (opoint):
    // request 60s, run 60s
    timeouts: { requestMs: 60_000, runMs: 60_000 },
    input: {
        /** The ARTICLE wire profile (v1 `ARTICLE_DEFAULTS`), layered UNDER
         *  the caller's `params` — the caller wins on the one shared key
         *  (`requestedarticles`; 10 is v1's page default, not a vendor
         *  default, hence toRequest rather than a schema `.default()`).
         *  The rest are content toggles the strict input schema does not
         *  expose: text on so the snippet has a source, `max_article_length`
         *  256 = the agreement's verbatim-extract ceiling, subjects and
         *  readership as licensed metadata. `summary` stays OFF: Opoint
         *  truncates summary + text to `max_article_length` JOINTLY,
         *  summary first (docs: search-request), so requesting the lede
         *  would spend the 256 budget on text the projection never emits.
         *  `/search` and
         *  `/search-advanced` inherit; headlines and by-ids override with
         *  their own profile. */
        toRequest: ({ data, utils }) => {
            const body = data.input.body ?? {};
            const params = utils.json.optionalGet(body, "$.params") ?? {};
            return {
                ...data.input,
                body: utils.json.merge(body, {
                    params: utils.json.merge(params, {
                        requestedarticles: utils.json.optionalNum(
                            params,
                            "$.requestedarticles",
                        ) ??
                            10,
                        main: { header: 1, text: 1 },
                        max_article_length: 256,
                        allsubject: "0",
                        readership: true,
                    }),
                }),
            };
        },
    },
    lifecycle: {
        /** Opoint reports a failed search on HTTP 200: `searchresult.
         *  response_code` ≠ 200 or an `errors` string (observed
         *  2026-09-13: `{response_code: 500, errors: "Solr could not
         *  handle the query"}`). The declarative path judges by HTTP
         *  status alone, so `start` takes over the one exchange and
         *  synthesizes 422 (OURS) over providerHttpStatus 200 (THEIRS,
         *  design D12) — the engine then forces zero usage. Only the
         *  search envelope is judged: a 2xx body without `searchresult`
         *  (the suggestion host) relays verbatim. v1 lineage:
         *  relayOpointSearch + OPOINT_SYNTHETIC_ERROR_STATUS. */
        start: async ({ utils }) => {
            const res = await utils.request();
            if (res.status < 200 || res.status >= 300) {
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            const errors = utils.json.optionalGet(
                res.body,
                "$.searchresult.errors",
            );
            const code = utils.json.optionalNum(
                res.body,
                "$.searchresult.response_code",
            );
            const failed = (typeof errors === "string" && errors.length > 0) ||
                (code !== undefined && code !== 200);
            if (failed) {
                return {
                    kind: "COMPLETED",
                    httpStatus: 422,
                    providerHttpStatus: res.status,
                    output: res.body,
                };
            }
            return {
                kind: "COMPLETED",
                httpStatus: res.status,
                output: res.body,
            };
        },
    },
    output: {
        /** The agreement's per-article field list (Special Terms,
         *  2026-06-25: headline, author, publication date, original URL,
         *  at most 256 verbatim characters, no summaries) — an honest
         *  removal visible to every caller, so it is a doc-level
         *  projection, not host redaction. Dropped on purpose: the
         *  tracking `url` (embeds the account id), `body` / `summary` /
         *  `short_body` / `quotes` / `caption` / `matches` /
         *  `identical_documents`, and search internals. The snippet is
         *  body text only (the lede is Opoint's `summary`, which the
         *  agreement excludes), tags stripped, hard-capped at 256. Non-search
         *  envelopes pass through (suggest overrides anyway). v1 lineage:
         *  projectSearchResult / projectDocument / buildSnippet. */
        fromResponse: ({ data, utils }) => {
            const result = utils.json.optionalGet(
                data.output,
                "$.searchresult",
            );
            if (result === undefined) return data.output;
            const docs = utils.json.optionalGet(result, "$.document");
            const rows = Array.isArray(docs) ? docs : [];
            const projected = rows.map((doc) => {
                const out = utils.json.pick(doc, [
                    "$.id_site",
                    "$.id_article",
                    "$.author",
                    "$.unix_timestamp",
                    "$.local_time",
                    "$.orig_url",
                    "$.url_common",
                    "$.language",
                    "$.countrycode",
                    "$.countryname",
                    "$.site_rank",
                    "$.first_source",
                    "$.mediatype",
                    "$.word_count",
                    "$.similarweb",
                ]);
                const header = utils.json.optionalGet(doc, "$.header.text");
                out.header = typeof header === "string" ? header : "";
                const topics = utils.json.optionalGet(doc, "$.topics");
                if (Array.isArray(topics)) {
                    out.topics = topics.map((topic) =>
                        utils.json.pick(topic, ["$.id", "$.text"])
                    );
                }
                const body = utils.json.optionalGet(doc, "$.body.text");
                const text = (typeof body === "string" ? body : "")
                    .replace(/<[^>]+>/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();
                if (text.length > 0) out.snippet = text.slice(0, 256);
                return out;
            });
            return {
                ...utils.json.pick(result, [
                    "$.documents",
                    "$.first_timestamp",
                    "$.last_timestamp",
                    "$.context",
                    "$.range_count",
                    // the parser's search-term corrections (docs:
                    // search-response) — a caller needs to know its query
                    // was reinterpreted; not a search internal
                    "$.debug",
                ]),
                document: projected,
            };
        },
    },
    usage: {
        /** THE credit system (design D26): Opoint's native meter is the
         *  agreement's monthly band of Search API CALLS — one pool,
         *  drawn 1 per search request by every search doc; `/suggest` is
         *  FREE. No `consolidate`: no response carries a receipt. */
        credits: { default: { label: "Opoint search calls" } },
    },
});
