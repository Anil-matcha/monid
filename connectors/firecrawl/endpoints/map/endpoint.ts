import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zMapBody } from "./schema/inputs.ts";

/**
 * `POST /v2/map` — discover a site's URLs without scraping any page.
 *
 * BILLING: the one genuinely FLAT endpoint — 1 credit per call however many
 * links return, so `limit` is a behavior knob rather than a billing
 * multiplier and stays optional at the binding (a PER_UNIT model would bill
 * per returned link, wrong by orders of magnitude). A flat model has exactly
 * one lawful quantities fn, so the compiler synthesizes both and this doc
 * declares neither.
 *
 * `/map` is also the one Firecrawl response with NO `creditsUsed` meter
 * (verified live 2026-09-16: `{success, id, links}`), so the provider's
 * consolidate omits its claim and the derived fold — a flat 1 — settles the
 * run on its own.
 *
 * `threatProtection` rides the mirror because the vendor accepts it, but it
 * is NOT modeled here: the published "+2 credits per URL scanned" has no
 * stated basis for a discovery call that fetches no pages, and this endpoint
 * is flat-rated. Any real draw arrives through the vendor's own claim.
 */
export default defineEndpoint({
    meta: {
        displayName: "Firecrawl Map",
        summary: "List a website's URLs, fast, without scraping content.",
        description: "Give a domain and get back its URLs without scraping " +
            "any page content — the cheap reconnaissance step before a " +
            "crawl or batch scrape. `sitemap` selects whether the site's " +
            "sitemap is combined with link discovery ('include'), used " +
            "exclusively ('only'), or skipped; `search` orders the returned " +
            "URLs by relevance to a term; `includeSubdomains` widens scope; " +
            "`limit` caps the set. One flat charge per call however many " +
            "URLs return. The response is links and titles only — no page " +
            "content; pipe the URLs into a scrape or batch scrape when you " +
            "need the text.",
        docsUrl: "https://docs.firecrawl.dev/api-reference/endpoint/map",
        categories: ["web-scraping"],
    },
    request: { method: "POST", path: "/map" },
    input: { schema: { body: zMapBody } },
    usage: {
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "map call",
            description: "one flat charge per call, any number of links",
            consumes: { credit: "default", amount: 1 },
        },
    },
});
