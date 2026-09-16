import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zOpointSearchAdvancedBody } from "./schema/inputs.ts";

/**
 * `/search-advanced` — structured expression lines with typed filter ids.
 * Same article profile, verdict and projection as `/search` (all
 * inherited); only the input shape differs.
 */
export default defineEndpoint({
    meta: {
        displayName: "Search News with Filters",
        summary:
            "Search news with structured expression lines and typed filter ids.",
        description: "Combine required, optional, and excluded search " +
            "lines, each with its own searchterm and a list of {type, id} " +
            "filters (lang, geo, site, media, content, subject, topic, ent, " +
            "url, domain) taken straight from the /suggest lookup. Returns " +
            "the same article shape as /search: headline, author, " +
            "publication time, original URL, site domain, language, country, " +
            "site rank, source, media type, word count, subject topics, " +
            "readership estimates, 256-character snippet, and a " +
            "pagination context. Supports a published-time window, " +
            "oldest-first ordering, excluded ids, and 1-100 articles per " +
            "page. Suited for monitoring profiles that mix several " +
            "sources, regions, and exclusions without hand-building a " +
            "query string.",
        docsUrl: "https://api-docs.opoint.com/references/search-request",
        categories: ["news-search"],
    },
    /** PUBLIC identity (design D22): shares the upstream `POST /search/`. */
    endpoint: "/search-advanced",
    request: { method: "POST", path: "/search/" },
    input: { schema: { body: zOpointSearchAdvancedBody } },
    usage: {
        // one Search API call from the agreement band — see provider.ts
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "search call",
            consumes: { credit: "default", amount: 1 },
        },
    },
});
