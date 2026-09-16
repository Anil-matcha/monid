import { defineEndpoint, UsageModelKind } from "@shared/core";
import {
    zBatchScrapeStatusPathParams,
    zBatchScrapeStatusQueryParams,
} from "./schema/inputs.ts";

/**
 * `GET /v2/batch/scrape/{id}` — read a batch scrape job: its status, counts,
 * and a chunk of its results.
 *
 * The batch half of the same pair as `firecrawl#crawl/{id}`:
 * `firecrawl#batch/scrape` starts the job and settles on the first chunk, and
 * this endpoint reaches the rest when that chunk carries a `next` cursor.
 */
export default defineEndpoint({
    meta: {
        displayName: "Get Batch Scrape Status",
        summary: "Read a batch scrape job's status and a chunk of its results.",
        description: "Read a batch scrape job by id: its status, page " +
            "counts, credits used, and a chunk of the scraped pages. " +
            "Firecrawl caps a response at 10 MB, so a large batch returns " +
            "its pages in chunks — the batch result carries the first chunk " +
            "plus a `next` URL. Call this with the job `id` and the `skip` " +
            "from that URL to pull the following chunk, repeating until " +
            "`next` is absent. Free — reading a job consumes no credits; the " +
            "batch itself was already billed. Jobs expire roughly 24 hours " +
            "after they complete, which the response reports as `expiresAt`.",
        docsUrl:
            "https://docs.firecrawl.dev/api-reference/endpoint/batch-scrape-get",
        categories: ["web-scraping"],
    },
    /** PUBLIC identity (design D22): DECLARED, and identical to the vendor's
     *  own path — what the caller sees is what we call. */
    endpoint: "/batch/scrape/{id}",
    request: { method: "GET", path: "/batch/scrape/{id}" },
    input: {
        schema: {
            pathParams: zBatchScrapeStatusPathParams,
            queryParams: zBatchScrapeStatusQueryParams,
        },
    },
    /** Short-request budget rather than the provider's 300 s — see
     *  firecrawl#crawl/{id}. */
    timeouts: { requestMs: 30_000, runMs: 60_000 },
    usage: {
        /** Reading a job is free — see firecrawl#crawl/{id}. */
        model: { kind: UsageModelKind.FREE },
        /** MUST override the provider consolidate, which would otherwise
         *  re-claim the WHOLE JOB's `creditsUsed` on every chunk read. */
        consolidate: ({ data }) => ({ credits: {}, output: data.output }),
    },
});
