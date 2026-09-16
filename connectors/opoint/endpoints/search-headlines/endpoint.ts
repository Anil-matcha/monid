import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zOpointSearchHeadlinesBody } from "./schema/inputs.ts";

/**
 * `/search-headlines` — the `/search` expression, headlines only. Overrides
 * the provider's ARTICLE profile with the HEADLINE one; the projection then
 * emits no `snippet` because no text arrives.
 */
export default defineEndpoint({
    meta: {
        displayName: "Search News Headlines",
        summary:
            "Search global news and return headlines only, without article text.",
        description: "Same search expression as /search (keywords, " +
            "phrases, section prefixes, boolean operators, filter ids) " +
            "but each article comes back without a text snippet: " +
            "headline, author, publication time, original URL, site " +
            "domain, language, country, site rank, source, media type, " +
            "word count, subject topics, and readership estimates, 20 per " +
            "page by default. Supports a published-time window, " +
            "oldest-first ordering, excluded ids, and pagination. Suited " +
            "for scanning coverage volume, building link lists, and " +
            "picking which ids to fetch with a snippet via /search-by-ids.",
        docsUrl: "https://api-docs.opoint.com/references/search-request",
        categories: ["news-search"],
    },
    /** PUBLIC identity (design D22): shares the upstream `POST /search/`. */
    endpoint: "/search-headlines",
    request: { method: "POST", path: "/search/" },
    input: {
        schema: { body: zOpointSearchHeadlinesBody },
        /** The HEADLINE wire profile (v1 `HEADLINE_DEFAULTS`) under the
         *  caller's `params`: header only, no text and no length cap, a
         *  bigger page (20 — v1's choice, not a vendor default). Differs
         *  from the provider's ARTICLE profile in exactly those knobs. */
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
                            20,
                        main: { header: 1 },
                        allsubject: "0",
                        readership: true,
                    }),
                }),
            };
        },
    },
    usage: {
        // one Search API call from the agreement band — see provider.ts
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "search call",
            consumes: { credit: "default", amount: 1 },
        },
    },
});
