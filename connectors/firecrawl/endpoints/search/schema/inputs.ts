import { z } from "zod";
import {
    zScrapeOptions,
    zThreatProtectionOverride,
} from "../../../schema/common.ts";

/** `POST /v2/search` `sources` item. */
const zSearchSource = z.union([
    z.object({
        type: z.literal("web"),
        tbs: z.string().optional().describe(
            "Time filter: 'qdr:h|d|w|m|y', a custom " +
                "'cdr:1,cd_min:MM/DD/YYYY,cd_max:MM/DD/YYYY' range, or " +
                "'sbd:1' to sort by date. Values combine, e.g. 'sbd:1,qdr:w'.",
        ),
        location: z.string().optional(),
    }),
    z.object({ type: z.literal("images") }),
    z.object({ type: z.literal("news") }),
]);

/** `POST /v2/search` `categories` item. */
const zSearchCategory = z.union([
    z.object({ type: z.literal("developer") }),
    z.object({ type: z.literal("research") }),
    z.object({ type: z.literal("pdf") }),
]);

/** `POST /v2/search` request body — the OpenAPI schema, optionality only. */
export const zSearchBody = z.object({
    query: z.string().max(500).describe("The search query.").meta({
        examples: ["latest temporal workflow best practices"],
    }),
    limit: z.number().int().min(1).max(100).optional().describe(
        "Maximum results to return, per source type when several sources " +
            "are requested (vendor default 10). Search bills 2 credits per " +
            "10 results, rounded up, so 11 results cost 4.",
    ),
    sources: z.array(zSearchSource).optional().describe(
        "Sources to search — determines which arrays appear in the " +
            "response. Defaults to web.",
    ),
    categories: z.array(zSearchCategory).optional().describe(
        "Filter results by category. Defaults to no filtering.",
    ),
    includeDomains: z.array(z.string()).optional().describe(
        "Restrict results to these hostnames. Cannot be combined with " +
            "excludeDomains.",
    ),
    excludeDomains: z.array(z.string()).optional().describe(
        "Exclude these hostnames. Cannot be combined with includeDomains.",
    ),
    tbs: z.string().optional().describe(
        "Time filter applied across sources — see the web source's `tbs`.",
    ),
    location: z.string().optional().describe(
        "Location for search results (e.g. " +
            "'San Francisco,California,United States').",
    ),
    country: z.string().optional().describe(
        "ISO country code for geo-targeting (default 'US').",
    ),
    safe: z.boolean().optional().describe(
        "Filter explicit content. Omit to keep the default behavior.",
    ),
    timeout: z.number().int().min(1).optional().describe(
        "Timeout in ms (default 60000).",
    ),
    ignoreInvalidURLs: z.boolean().optional().describe(
        "Drop results whose URLs are invalid for other Firecrawl endpoints " +
            "(default false).",
    ),
    highlights: z.boolean().optional().describe(
        "Generate query-relevant highlights for results (default true). " +
            "This is the free search-snippet highlighter, NOT the priced " +
            "`highlights` scrape format.",
    ),
    enterprise: z.array(z.enum(["anon", "zdr"])).optional().describe(
        "Enterprise Zero Data Retention options. ['zdr'] is end-to-end ZDR " +
            "at 10 credits per 10 results; ['anon'] is anonymized ZDR at the " +
            "standard 2 credits per 10 results. Must be enabled for your " +
            "team.",
    ),
    scrapeOptions: zScrapeOptions.optional().describe(
        "Scrape each result's full content in the same call. Adds the " +
            "per-page scrape cost for every result returned.",
    ),
    threatProtection: zThreatProtectionOverride.optional(),
});
