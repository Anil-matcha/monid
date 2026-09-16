import { z } from "zod";

/** `GET /v2/crawl/{id}` path parameters. */
export const zCrawlStatusPathParams = z.object({
    id: z.string().min(1).describe(
        "The crawl job id, returned as `id` by firecrawl#crawl.",
    ),
});

/**
 * `GET /v2/crawl/{id}` query parameters.
 *
 * `skip` does not appear in the OpenAPI parameter list for this operation,
 * but Firecrawl itself uses it: the `next` cursor on a chunked response is
 * `…/v2/crawl/<id>?skip=N` (verified against a real recording, 2026-09-16).
 * The mirror carries it because the vendor does.
 */
export const zCrawlStatusQueryParams = z.object({
    skip: z.number().int().min(0).optional().describe(
        "How many results to skip — the `skip` value carried by the previous " +
            "response's `next` URL. Omit for the first chunk.",
    ),
});
