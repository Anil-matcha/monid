# Proposal: add-connector-firecrawl

## Why

Firecrawl is the web-data primitive agents reach for first: scrape a URL into
clean markdown, crawl a site, map its URLs, search the live web, or hand an
autonomous agent a prompt. Its v2 API is a clean fit for the connector
standard — one base URL, bearer auth, a uniform job protocol across all three
async endpoints, and a `creditsUsed` meter on every billable response — so
nothing about it needs a new engine capability.

It is also the first connector whose billing is a genuinely LONG modifier
stack: a page is 1 credit, but eleven request fields can add to it and the
largest multiplies the bill by 30. That makes it the first real test of the
D29 completeness rule, and of whether a doc-level estimate can stay honest
without inventing input structure the vendor does not have.

## What Changes

- **connectors/firecrawl** — 6 endpoints against
  `https://api.firecrawl.dev/v2`, bearer auth, inheriting the provider's
  credit pool, vendor-meter `usage.consolidate` and `output.fromError`.
  - 3 sync: `POST /scrape`, `POST /map`, `POST /search`.
  - 3 async: `POST /crawl`, `POST /batch/scrape`, `POST /agent`, each
    carrying the job lifecycle.
- **Faithful mirrors, no wire layer.** `schema/inputs.ts` and
  `schema/common.ts` mirror the published v2 OpenAPI components field for
  field — including the native `formats` union, `parsers`, `actions`,
  `redactPII`, `lockdown`, `zeroDataRetention` and `threatProtection`. No
  endpoint declares `input.toRequest`: the validated input IS the wire body.
  Estimates read the native shapes directly (a `json` format is
  `formats.some(f => f.type === "json")`, not an invented boolean).
- **Per-modifier billing.** `/scrape`, `/crawl` and `/batch/scrape` price a
  13-component composite — a base page plus each published surcharge as its
  own named, labelled line (`json`, `question`, `highlights`, `audio`,
  `video`, `redact_pii`, `prompt_injection_check`, `lockdown`,
  `zero_data_retention`, `threat_protection_scan`, `x_routing`, `pdf_page`).
  `/search` prices the block rate (`every: 10` at 2 credits) plus the same
  stack per scraped result plus a `zdr_search` line for the enterprise ZDR
  rate. `/map` is a flat `PER_CALL` 1. `/agent` meters in `CREDIT` units
  because Firecrawl publishes no formula for it.
- **One interned lifecycle.** The three job endpoints derive the status URL as
  `request.url + "/" + id`, so they author byte-identical `start`/`poll`/`stop`
  sources that content-addressing interns to one fnTable entry per phase. The
  lifecycle sits on the endpoints, not the provider, because a provider-level
  `start` would be inherited by the synchronous three and replace their
  declarative execution.
- **`next` is followed, not passed through.** A paginated job cursor is an
  authenticated Firecrawl URL the caller cannot fetch, so the poll walks the
  chain (bounded at 20 pages) and returns one complete result set.
- Real recorded fixtures, hand-minimized into 9 provider-level shared chains.

## Capabilities

- `firecrawl-connector`.

## Non-goals

- `/interact`, `/parse`, `/monitor` and `/crawl/params-preview` are not
  ported; `/extract` is deprecated upstream. `/interact` in particular bills
  per browser MINUTE (2–7 credits), a time-metered shape no connector models
  yet — it should arrive with its own change.
- No new category leaves: `web-scraping` and `web-search` already exist.
- No dollar conversion in the doc. Firecrawl's $/credit is plan-dependent
  (pay-as-you-go runs $0.005 on Hobby down to $0.001 on Scale), so the pool is
  the vendor's own credits and the conversion stays the broker card's job.

## Impact

New connector tree + README row. No schema, compiler or engine change:
`ENGINE_VERSION` is untouched, no new `Unit`, no new preset, no new hook.
