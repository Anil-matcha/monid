import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zOpointSearchByIdsBody } from "./schema/inputs.ts";

/**
 * `/search-by-ids` — fetch known articles by site/article id pairs. The
 * article profile is the provider's, plus two wire facts only this doc
 * knows: `select_by_ids` skips the search engine, and `requestedarticles`
 * must be at least the id count or the upstream caps the result (docs:
 * "Get articles with specific ids").
 */
export default defineEndpoint({
    meta: {
        displayName: "Fetch Articles by Id",
        summary: "Fetch specific articles by their site and article id pairs.",
        description: "Look up 1-100 known articles by id_site + " +
            "id_article, the pair every search result carries. Returns per " +
            "article the headline, author, publication time, original " +
            "URL, site domain, language, country, site rank, source, media " +
            "type, word count, subject topics, readership estimates, and a " +
            "256-character snippet. Skips the search engine entirely, so " +
            "it is the cheap way to re-read articles found earlier. Suited " +
            "for refreshing readership numbers on tracked articles or " +
            "re-hydrating ids stored by an agent.",
        docsUrl: "https://api-docs.opoint.com/references/search-request",
        categories: ["news-search"],
    },
    /** PUBLIC identity (design D22): shares the upstream `POST /search/`. */
    endpoint: "/search-by-ids",
    request: { method: "POST", path: "/search/" },
    input: {
        schema: { body: zOpointSearchByIdsBody },
        /** The ARTICLE profile (as the provider's) + `select_by_ids` +
         *  `requestedarticles` sized to the id list (the caller's value
         *  is overridden: fewer would silently truncate). v1 lineage:
         *  byIdsToWire over ARTICLE_DEFAULTS. */
        toRequest: ({ data, utils }) => {
            const body = data.input.body ?? {};
            const params = utils.json.get(body, "$.params");
            return {
                ...data.input,
                body: utils.json.merge(body, {
                    params: utils.json.merge(params, {
                        select_by_ids: true,
                        requestedarticles: utils.json.len(params, "$.articles"),
                        main: { header: 1, text: 1 },
                        max_article_length: 256,
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
