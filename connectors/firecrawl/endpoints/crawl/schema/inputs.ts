import { z } from "zod";
import { zScrapeOptions, zWebhook } from "../../../schema/common.ts";

/** `POST /v2/crawl` request body — the OpenAPI schema, optionality only. */
export const zCrawlBody = z.object({
    url: z.url().describe("The base URL to start crawling from."),
    prompt: z.string().optional().describe(
        "Natural-language description of what to crawl; Firecrawl derives " +
            "the crawler options from it. Explicitly set parameters win.",
    ),
    excludePaths: z.array(z.string().max(2_000)).max(1_000).optional()
        .describe(
            "Rust-regex (RE2) pathname patterns that exclude matching URLs. " +
                "Look-around and backreferences are unsupported; a pattern " +
                "that does not compile is rejected with a 400.",
        ),
    includePaths: z.array(z.string().max(2_000)).max(1_000).optional()
        .describe(
            "Rust-regex (RE2) pathname patterns that include matching URLs. " +
                "The starting URL is checked too — if it matches none, the " +
                "crawl may return 0 pages.",
        ),
    maxDiscoveryDepth: z.number().int().min(0).optional().describe(
        "Maximum link depth. The root and sitemapped pages are depth 0.",
    ),
    sitemap: z.enum(["skip", "include", "only"]).optional().describe(
        "'include' (default) combines the sitemap with link discovery, " +
            "'only' crawls sitemap URLs plus the start URL, 'skip' ignores it.",
    ),
    ignoreQueryParameters: z.boolean().optional().describe(
        "Do not re-scrape the same path with different query parameters " +
            "(default false).",
    ),
    regexOnFullURL: z.boolean().optional().describe(
        "Match includePaths / excludePaths against the full URL including " +
            "query parameters, not just the pathname (default false).",
    ),
    limit: z.number().int().min(1).optional().describe(
        "Maximum pages to crawl (vendor default 10000). Each page crawled " +
            "is billed, so state the cap you actually want.",
    ),
    crawlEntireDomain: z.boolean().optional().describe(
        "Follow sibling and parent URLs, not just child paths " +
            "(default false).",
    ),
    allowExternalLinks: z.boolean().optional().describe(
        "Follow links to external sites, one hop (default false).",
    ),
    allowSubdomains: z.boolean().optional().describe(
        "Follow links to subdomains of the main domain (default false).",
    ),
    ignoreRobotsTxt: z.boolean().optional().describe(
        "Ignore the site's robots.txt. Enterprise-gated.",
    ),
    robotsUserAgent: z.string().optional().describe(
        "User-Agent used to evaluate robots.txt. Enterprise-gated.",
    ),
    delay: z.number().min(0).optional().describe(
        "Seconds between page fetches. Setting this forces concurrency to " +
            "1, so `limit` times `delay` is a floor on how long the crawl " +
            "takes and it must fit the 30-minute run budget — 1000 pages at " +
            "2 seconds cannot finish in time, and a run that overruns is " +
            "cancelled with its pages already billed.",
    ),
    maxConcurrency: z.number().int().min(1).optional().describe(
        "Concurrency cap for this crawl. Defaults to the team limit.",
    ),
    webhook: zWebhook.optional(),
    scrapeOptions: zScrapeOptions.optional().describe(
        "Per-page scrape config; accepts the full scrape option set. " +
            "Defaults to markdown only.",
    ),
    zeroDataRetention: z.boolean().optional().describe(
        "Persist nothing beyond the lifetime of the crawl (default false). " +
            "Enterprise-gated; costs +1 credit per page.",
    ),
});
