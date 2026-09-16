import { z } from "zod";

/**
 * Firecrawl v2 shared request fragments — the FAITHFUL VENDOR MIRROR of the
 * published OpenAPI components (`https://docs.firecrawl.dev/api-reference/
 * v2-openapi.json`, captured 2026-09-16). Optionality ONLY: no `.default()`,
 * no invented structure, no reshaping (D25). The vendor's documented defaults
 * are recorded in `describe` text so callers can read them; where one matters
 * to an estimate it is applied at the BINDING in `endpoint.ts`, never here.
 *
 * Nothing is `.strict()`: Firecrawl ships new scrape options continuously and
 * a strict mirror would reject a request the vendor accepts. Unknown keys pass
 * through untouched — which is also why no endpoint needs `input.toRequest`:
 * the validated input IS the wire body.
 */

/** OpenAPI `ScrapeOptions.location` (also `/map` and `/search`). */
export const zLocation = z.object({
    country: z.string().regex(/^[A-Z]{2}$/).optional().describe(
        "ISO 3166-1 alpha-2 country code (e.g. 'US', 'AU', 'DE', 'JP'). " +
            "Defaults to 'US'.",
    ),
    languages: z.array(z.string()).optional().describe(
        "Preferred languages and locales in order of priority (e.g. " +
            "['en-US']). Defaults to the language of the location.",
    ),
});

/** OpenAPI `RedactPIIEntity`. */
export const zRedactPIIEntity = z.enum([
    "PERSON",
    "EMAIL",
    "PHONE",
    "LOCATION",
    "FINANCIAL",
    "SECRET",
]);

/** OpenAPI `RedactPIIOptions`. */
export const zRedactPIIOptions = z.object({
    mode: z.enum(["accurate", "aggressive", "fast"]).optional().describe(
        "Redaction strategy. 'accurate' (default) is model-only and " +
            "optimized for precision, 'aggressive' increases recall with " +
            "extra heuristics, 'fast' uses heuristics without the model call.",
    ),
    entities: z.array(zRedactPIIEntity).optional().describe(
        "Restrict redaction to these entity buckets. Omit to redact all.",
    ),
    replaceStyle: z.enum(["tag", "mask", "remove"]).optional().describe(
        "'tag' (default) replaces spans with placeholders like <EMAIL>, " +
            "'mask' replaces characters with *, 'remove' deletes the span.",
    ),
});

/**
 * OpenAPI `ThreatProtectionOverride`. Enterprise-gated per-request override;
 * `mode: "normal"` is a BILLABLE line (+2 credits per URL scanned), which is
 * why the mirror carries it rather than leaving it to the account policy.
 */
export const zThreatProtectionOverride = z.object({
    mode: z.enum(["off", "normal"]).optional().describe(
        "URL scanning mode for this request. 'normal' checks URLs against " +
            "Google Web Risk and costs +2 credits per URL scanned.",
    ),
    riskScoreThreshold: z.number().int().min(0).max(100).optional(),
    blacklist: z.array(z.string()).max(1000).optional(),
    whitelist: z.array(z.string()).max(1000).optional(),
    blockedTlds: z.array(z.string()).max(1000).optional(),
    failurePolicy: z.enum(["open", "closed"]).optional(),
});

/** OpenAPI `AuditMetadata` — SIEM attribution, enterprise-gated. */
export const zAuditMetadata = z.object({
    username: z.string().max(1024).describe(
        "The username associated with the request.",
    ),
});

/**
 * OpenAPI `ScrapeOptions.parsers` item. The bare string `"pdf"` and the
 * object form are both accepted; an EMPTY parsers array skips PDF parsing and
 * returns base64 at a flat 1 credit instead of 1 credit per PDF page.
 */
export const zParser = z.union([
    z.literal("pdf"),
    z.object({
        type: z.literal("pdf"),
        mode: z.enum(["fast", "auto", "ocr"]).optional().describe(
            "'fast': embedded text only. 'auto' (default): fast with OCR " +
                "fallback. 'ocr': force OCR on every page.",
        ),
        maxPages: z.number().int().min(1).max(10_000).optional().describe(
            "Cap the number of PDF pages parsed.",
        ),
        pages: z.boolean().optional().describe(
            "Also return per-page markdown in `pages`. No additional cost.",
        ),
        blocks: z.boolean().optional().describe(
            "Also return per-page typed layout blocks. No additional cost.",
        ),
        pageMarkers: z.boolean().optional().describe(
            "Annotate page breaks in the markdown. No additional cost.",
        ),
    }),
]);

/** OpenAPI `ScrapeOptions.actions` item — browser steps run before scraping. */
export const zAction = z.union([
    z.object({
        type: z.literal("wait"),
        milliseconds: z.number().int().min(1).optional(),
        selector: z.string().optional(),
    }).describe("Wait for a duration OR for an element — provide one."),
    z.object({
        type: z.literal("screenshot"),
        fullPage: z.boolean().optional(),
        quality: z.number().int().min(1).max(100).optional(),
        viewport: z.object({
            width: z.number().int(),
            height: z.number().int(),
        }).optional(),
    }),
    z.object({
        type: z.literal("click"),
        selector: z.string(),
        all: z.boolean().optional(),
    }),
    z.object({ type: z.literal("write"), text: z.string() }),
    z.object({ type: z.literal("press"), key: z.string() }),
    z.object({
        type: z.literal("scroll"),
        direction: z.enum(["up", "down"]).optional(),
        selector: z.string().optional(),
    }),
    z.object({ type: z.literal("scrape") }),
    z.object({ type: z.literal("executeJavascript"), script: z.string() }),
    z.object({
        type: z.literal("pdf"),
        format: z.enum([
            "A0",
            "A1",
            "A2",
            "A3",
            "A4",
            "A5",
            "A6",
            "Letter",
            "Legal",
            "Tabloid",
            "Ledger",
        ]).optional(),
        landscape: z.boolean().optional(),
        scale: z.number().optional(),
    }),
]);

/**
 * OpenAPI `Formats` item. The spec declares object variants only, but the API
 * accepts the bare string spelling for every option-less format (verified
 * live 2026-09-16: `formats: ["markdown"]` returns 200) and every official
 * example uses it — so the mirror is the honest superset of both spellings.
 *
 * Four variants carry a per-page LLM surcharge (`json`, `question`,
 * `highlights`, and the `audio` / `video` extractors); `usage.estimate` reads
 * this array directly, which is why no scalar flattening is needed.
 */
export const zScrapeFormat = z.union([
    z.enum([
        "markdown",
        "summary",
        "html",
        "rawHtml",
        "rawBase64",
        "links",
        "images",
        "screenshot",
        "branding",
        "product",
        "menu",
        "audio",
        "video",
    ]),
    z.object({
        type: z.enum([
            "markdown",
            "summary",
            "html",
            "rawHtml",
            "rawBase64",
            "links",
            "images",
            "branding",
            "product",
            "menu",
            "audio",
            "video",
        ]),
    }),
    z.object({
        type: z.literal("screenshot"),
        fullPage: z.boolean().optional(),
        quality: z.number().int().min(1).max(100).optional(),
        viewport: z.object({
            width: z.number().int(),
            height: z.number().int(),
        }).optional(),
    }),
    z.object({
        type: z.literal("json"),
        schema: z.record(z.string(), z.unknown()).optional().describe(
            "JSON Schema the extracted object must conform to.",
        ),
        prompt: z.string().optional().describe(
            "What to extract from the page.",
        ),
        checkPromptInjection: z.boolean().optional().describe(
            "Scan the page for prompt-injection attempts before extracting. " +
                "Adds 4 credits when the check runs; a detection fails the " +
                "request with 403 SCRAPE_PROMPT_INJECTION_DETECTED.",
        ),
    }),
    z.object({
        type: z.literal("changeTracking"),
        modes: z.array(z.enum(["git-diff", "json"])).optional(),
        schema: z.record(z.string(), z.unknown()).optional(),
        prompt: z.string().optional(),
        tag: z.string().nullable().optional(),
    }).describe("Requires 'markdown' to also be in the formats array."),
    z.object({
        type: z.literal("question"),
        question: z.string().max(10_000).describe(
            "Natural-language question about the page; the answer lands in " +
                "the response's `answer` field.",
        ),
    }),
    z.object({
        type: z.literal("highlights"),
        query: z.string().max(10_000).describe(
            "Source-text selection request; the selection lands in the " +
                "response's `highlights` field.",
        ),
    }),
]);

/**
 * OpenAPI `ScrapeOptions` — the per-page option set shared by `/scrape`,
 * `/batch/scrape` (top level), and `/crawl` + `/search` (nested under
 * `scrapeOptions`).
 */
export const zScrapeOptions = z.object({
    formats: z.array(zScrapeFormat).optional().describe(
        "Output formats. Defaults to ['markdown'].",
    ),
    onlyMainContent: z.boolean().optional().describe(
        "Return only the main content, excluding headers, navs and footers " +
            "(default true). A deterministic HTML-level filter; no LLM.",
    ),
    onlyCleanContent: z.boolean().optional().describe(
        "Beta. An additional LLM pass over the markdown to remove residual " +
            "boilerplate (default false).",
    ),
    includeTags: z.array(z.string()).optional().describe(
        "CSS selectors to include, matched against the original page DOM.",
    ),
    excludeTags: z.array(z.string()).optional().describe(
        "CSS selectors to exclude, matched against the original page DOM.",
    ),
    maxAge: z.number().int().min(0).optional().describe(
        "Serve a cached copy younger than this many ms (default 172800000, " +
            "2 days). 0 forces a live fetch. Cached results still cost a " +
            "full credit — caching buys speed, not credits.",
    ),
    minAge: z.number().int().min(0).optional().describe(
        "Cache-ONLY lookup: never triggers a fresh scrape. A miss returns " +
            "404 SCRAPE_NO_CACHED_DATA. Set 1 to accept any cached data.",
    ),
    headers: z.record(z.string(), z.string()).optional().describe(
        "Headers to send with the request (cookies, user-agent, etc.).",
    ),
    waitFor: z.number().int().min(0).optional().describe(
        "Extra ms to wait after load, on top of Firecrawl's smart wait " +
            "(default 0).",
    ),
    mobile: z.boolean().optional().describe(
        "Emulate a mobile device (default false).",
    ),
    skipTlsVerification: z.boolean().optional().describe(
        "Skip TLS certificate verification (default true).",
    ),
    timeout: z.number().int().min(1_000).max(300_000).optional().describe(
        "Per-page deadline in ms (default 60000, max 300000).",
    ),
    parsers: z.array(zParser).optional().describe(
        "File processing. Defaults to ['pdf'], which parses PDFs to " +
            "markdown at 1 credit per PDF page. An EMPTY array returns the " +
            "PDF as base64 at a flat 1 credit.",
    ),
    actions: z.array(zAction).optional().describe(
        "Browser actions to run before scraping. Max 50; the combined wait " +
            "time must not exceed 60 s. Not supported for PDFs.",
    ),
    location: zLocation.optional(),
    removeBase64Images: z.boolean().optional().describe(
        "Replace base64 image URLs in markdown with a placeholder " +
            "(default true). Does not affect html or rawHtml.",
    ),
    blockAds: z.boolean().optional().describe(
        "Enable ad-blocking and cookie-popup blocking (default true).",
    ),
    proxy: z.enum(["basic", "enhanced", "auto"]).optional().describe(
        "'auto' (default) retries with enhanced anti-bot proxies when the " +
            "basic fetch is blocked. Enhanced proxies carry NO surcharge.",
    ),
    storeInCache: z.boolean().optional().describe(
        "Store the page in the Firecrawl index and cache (default true). " +
            "Sensitive options (actions, headers) force this false.",
    ),
    lockdown: z.boolean().optional().describe(
        "Serve from Firecrawl's cache only, never fetching the target " +
            "(default false). Billed 5 credits on a hit, 1 on a miss; a " +
            "miss returns 404 SCRAPE_LOCKDOWN_CACHE_MISS.",
    ),
    redactPII: z.union([z.boolean(), zRedactPIIOptions]).optional().describe(
        "Redact personally identifiable information from the returned " +
            "markdown (default false). Costs +4 credits per page.",
    ),
    profile: z.object({
        name: z.string().min(1).max(128),
        saveChanges: z.boolean().optional(),
    }).optional().describe(
        "Persistent browser storage shared by scrapes using the same name.",
    ),
    threatProtection: zThreatProtectionOverride.optional(),
    auditMetadata: zAuditMetadata.optional(),
});

/** The webhook spec object shared by `/crawl`, `/batch/scrape` and `/agent`. */
export const zWebhook = z.object({
    url: z.url().describe("Where to deliver the events."),
    headers: z.record(z.string(), z.string()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    events: z.array(z.string()).optional().describe(
        "Event types to deliver. Defaults to all.",
    ),
});
