import { z } from "zod";
import {
    zAuditMetadata,
    zLocation,
    zThreatProtectionOverride,
} from "../../../schema/common.ts";

/** `POST /v2/map` request body — the OpenAPI schema, optionality only. */
export const zMapBody = z.object({
    url: z.url().describe("The site to map (e.g. 'https://docs.example.com')."),
    search: z.string().optional().describe(
        "Order the returned URLs by relevance to this term.",
    ),
    sitemap: z.enum(["skip", "include", "only"]).optional().describe(
        "'include' (default) combines the sitemap with link discovery, " +
            "'only' trusts the sitemap alone, 'skip' ignores it.",
    ),
    includeSubdomains: z.boolean().optional().describe(
        "Include subdomains of the site (default true).",
    ),
    ignoreQueryParameters: z.boolean().optional().describe(
        "Drop URLs carrying query parameters (default true).",
    ),
    ignoreCache: z.boolean().optional().describe(
        "Bypass the sitemap cache, which holds for up to 7 days " +
            "(default false).",
    ),
    limit: z.number().int().min(1).max(100_000).optional().describe(
        "Maximum links to return (default 5000). Does not affect the " +
            "price — a map is one flat credit however many links come back.",
    ),
    timeout: z.number().int().min(1).optional().describe(
        "Timeout in ms. No timeout by default.",
    ),
    location: zLocation.optional(),
    auditMetadata: zAuditMetadata.optional(),
    threatProtection: zThreatProtectionOverride.optional(),
});
