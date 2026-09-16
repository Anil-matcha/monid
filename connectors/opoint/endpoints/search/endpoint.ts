import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zOpointSearchBody } from "./schema/inputs.ts";

/**
 * `/search` — one search expression, article results with a snippet.
 * Everything but the identity and the model is inherited from the
 * provider: token auth, the ARTICLE wire profile, the in-band 200 verdict,
 * the agreement projection.
 */
export default defineEndpoint({
    meta: {
        displayName: "Search News",
        summary:
            "Search global news by keyword, phrase, or boolean query with filters.",
        description: "Search news and media from 200+ countries with one " +
            "expression: keywords, quoted phrases, section prefixes " +
            "(header:, body:, author:, url:), wildcards, proximity, AND / " +
            "OR / ANDNOT, and filter ids (lang:en, geo:1203, site:318, " +
            "media:576). Returns per article the headline, author, " +
            "publication time, original URL, site domain, language, " +
            "country, site rank, source, media type, word count, subject " +
            "topics, readership estimates, and a 256-character snippet, " +
            "plus a pagination context. Supports a published-time window, " +
            "oldest-first ordering, excluded ids, and 1-100 articles per " +
            "page. Suited for media monitoring, brand and competitor " +
            "coverage, and news-driven research. Turn a country, site, " +
            "language, or media name into a filter id with /suggest; " +
            "re-read known articles with /search-by-ids.",
        docsUrl: "https://api-docs.opoint.com/references/search-request",
        categories: ["news-search"],
    },
    /** PUBLIC identity (design D22): all four searches relay to the ONE
     *  upstream `POST /search/`, so the vendor path is transport plumbing
     *  and each doc pins its v1 name. */
    endpoint: "/search",
    request: { method: "POST", path: "/search/" },
    input: { schema: { body: zOpointSearchBody } },
    usage: {
        /** One Search API call from the agreement band (v1
         *  makePerCallPrice(OPOINT_CALL_USD) — the USD is the broker's
         *  amortization; see provider.ts). Flat model: estimate and
         *  evidence are compiler-synthesized. */
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "search call",
            consumes: { credit: "default", amount: 1 },
        },
    },
});
