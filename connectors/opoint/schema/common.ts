import { z } from "zod";

/**
 * Shared input fragments for the four article searches — the caller-facing
 * allow-list v1 pinned (`adaptors/opoint/endpoints/common.ts`). Everything
 * outside it is rejected at validation on purpose: content toggles and
 * licensing flags are set by each doc's wire profile, and `update_search` /
 * `watch_id` / `track_id_*` would keep account-level state on Monid's shared
 * token (cross-tenant). The bounds (2000-char expression, 1-100 articles,
 * 100 exclusions) are v1's pinned scope — Opoint documents no maxima.
 */

export const zSearchterm = z.string().min(1).max(2000).describe(
    "Opoint search expression: keywords and 'quoted phrases', section " +
        "prefixes (header:, summary:, body:, author:, url:), wildcards " +
        "(spot*), proximity ('Trump Biden'~5), boolean AND / OR / ANDNOT, " +
        "and filter ids from /suggest (lang:en, geo:1203, site:318, " +
        'media:576). Example: "header:spotify AND lang:en".',
);

export const zArticleRef = z.strictObject({
    id_site: z.number().int().describe("Opoint site id."),
    id_article: z.number().int().describe(
        "Article id, unique within the site.",
    ),
});

export const zSearchParams = z.strictObject({
    requestedarticles: z.number().int().min(1).max(100).describe(
        "Articles to return (1-100, default 10).",
    ).optional(),
    oldest: z.number().int().describe(
        "Unix seconds; only articles published at or after this time.",
    ).optional(),
    newest: z.number().int().describe(
        "Unix seconds; only articles published at or before this time.",
    ).optional(),
    context: z.string().max(200).describe(
        "Pagination cursor from the previous response's context field; " +
            "resend the same search to get the next page.",
    ).optional(),
    sort_oldest_first: z.boolean().describe(
        "Oldest first instead of newest first.",
    ).optional(),
    excludearticles: z.array(zArticleRef).max(100).describe(
        "Site/article id pairs to leave out of the results.",
    ).optional(),
});
