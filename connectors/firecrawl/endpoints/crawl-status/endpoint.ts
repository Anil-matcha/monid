import { defineEndpoint, UsageModelKind } from "@shared/core";
import {
    zCrawlStatusPathParams,
    zCrawlStatusQueryParams,
} from "./schema/inputs.ts";

/**
 * `GET /v2/crawl/{id}` — read a crawl job: its status, counts, and a chunk of
 * its results.
 *
 * This is the second half of Firecrawl's crawl surface. `firecrawl#crawl`
 * starts a job and settles on the first chunk of results; when that chunk
 * carries a `next` cursor there is more, and this endpoint is how the caller
 * reaches it. The engine's poll calls the very same operation on every tick —
 * exposing it simply lets the caller do what we already do, rather than us
 * stitching an unbounded payload into one run on their behalf.
 */
export default defineEndpoint({
    meta: {
        displayName: "Get Crawl Status",
        summary: "Read a crawl job's status and a chunk of its results.",
        description: "Read a crawl job by id: its status, page counts, " +
            "credits used, and a chunk of the crawled pages. Firecrawl caps " +
            "a response at 10 MB, so a large crawl returns its pages in " +
            "chunks — the crawl result carries the first chunk plus a `next` " +
            "URL. Call this with the job `id` and the `skip` from that URL " +
            "to pull the following chunk, repeating until `next` is absent. " +
            "Free — reading a job consumes no credits; the crawl itself was " +
            "already billed. Jobs expire roughly 24 hours after they " +
            "complete, which the response reports as `expiresAt`.",
        docsUrl: "https://docs.firecrawl.dev/api-reference/endpoint/crawl-get",
        categories: ["web-scraping"],
    },
    /** PUBLIC identity (design D22): DECLARED, and identical to the vendor's
     *  own path — what the caller sees is what we call. */
    endpoint: "/crawl/{id}",
    request: { method: "GET", path: "/crawl/{id}" },
    input: {
        schema: {
            pathParams: zCrawlStatusPathParams,
            queryParams: zCrawlStatusQueryParams,
        },
    },
    /** Tighter than the provider's 300 s. That budget exists to honour the
     *  per-page `timeout` a caller may set on a SCRAPE; a job read takes no
     *  such field and just returns stored rows, so it gets the ordinary
     *  short-request budget instead. */
    timeouts: { requestMs: 30_000, runMs: 60_000 },
    usage: {
        /** Reading a job is free — Firecrawl's billing docs state that
         *  "polling or checking batch status does not consume credits", and
         *  the crawl itself was billed as its pages completed. */
        model: { kind: UsageModelKind.FREE },
        /** MUST override the provider consolidate. That one reads
         *  `$.creditsUsed` as the vendor's claim — and a job status body
         *  repeats the WHOLE JOB's cost on every chunk, so inheriting it
         *  would re-bill the entire crawl on every read. The claim is empty;
         *  the meter stays in the output as the job's own provenance. */
        consolidate: ({ data }) => ({ credits: {}, output: data.output }),
    },
});
