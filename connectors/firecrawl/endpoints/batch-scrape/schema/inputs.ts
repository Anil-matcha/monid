import { z } from "zod";
import { zScrapeOptions, zWebhook } from "../../../schema/common.ts";

/**
 * `POST /v2/batch/scrape` request body — the OpenAPI `allOf`: the batch
 * fields + `ScrapeOptions` at the TOP level (unlike `/crawl`, which nests
 * them under `scrapeOptions`) + `{zeroDataRetention}`.
 */
export const zBatchScrapeBody = zScrapeOptions.extend({
    urls: z.array(z.url()).describe("The URLs to scrape."),
    webhook: zWebhook.optional(),
    maxConcurrency: z.number().int().min(1).optional().describe(
        "Concurrency cap for this batch. Defaults to the team limit.",
    ),
    ignoreInvalidURLs: z.boolean().optional().describe(
        "Skip malformed entries and return them in `invalidURLs` instead of " +
            "failing the whole batch (default true).",
    ),
    zeroDataRetention: z.boolean().optional().describe(
        "Persist nothing beyond the lifetime of the batch (default false). " +
            "Enterprise-gated; costs +1 credit per page.",
    ),
});
