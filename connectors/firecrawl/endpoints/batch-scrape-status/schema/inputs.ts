import { z } from "zod";

/** `GET /v2/batch/scrape/{id}` path parameters. */
export const zBatchScrapeStatusPathParams = z.object({
    id: z.string().min(1).describe(
        "The batch scrape job id, returned as `id` by firecrawl#batch/scrape.",
    ),
});

/**
 * `GET /v2/batch/scrape/{id}` query parameters.
 *
 * `skip` does not appear in the OpenAPI parameter list for this operation,
 * but Firecrawl itself uses it: the `next` cursor on a chunked response is
 * `…/v2/batch/scrape/<id>?skip=N`. The mirror carries it because the vendor
 * does.
 */
export const zBatchScrapeStatusQueryParams = z.object({
    skip: z.number().int().min(0).optional().describe(
        "How many results to skip — the `skip` value carried by the previous " +
            "response's `next` URL. Omit for the first chunk.",
    ),
});
