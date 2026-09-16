import { z } from "zod";
import { zScrapeOptions } from "../../../schema/common.ts";

/**
 * `POST /v2/scrape` request body — the OpenAPI `allOf` composed exactly as the
 * spec states it: `{url}` + `ScrapeOptions` + `{zeroDataRetention}`.
 */
export const zScrapeBody = zScrapeOptions.extend({
    url: z.url().describe("The URL to scrape.").meta({
        examples: ["https://example.com/pricing"],
    }),
    zeroDataRetention: z.boolean().optional().describe(
        "Persist nothing beyond the lifetime of the request (default " +
            "false). Enterprise-gated; costs +1 credit per page and is " +
            "incompatible with the screenshot format.",
    ),
});
