# Tasks: add-connector-firecrawl

## 1. Drill the vendor surface

- [x] 1.1 Capture the published v2 OpenAPI; pin base url, auth, the six
      request schemas, the `Formats` union, `RedactPIIOptions`,
      `ThreatProtectionOverride`, `AuditMetadata`
- [x] 1.2 Verify the meter locations live: scrape `data.metadata.creditsUsed`
      (1 plain / 5 with json), search top-level (2 at limit 2), crawl + batch
      + agent top-level of the status body, map none
- [x] 1.3 Verify the job protocol live: submit `{success, id, url}`, status
      `scraping|processing → completed|failed`, `next` cursor, DELETE cancel
      on all three
- [x] 1.4 Settle the open questions: `checkPromptInjection` lives INSIDE the
      `json` format object; `threatProtection.mode: "normal"` is a
      per-request +2/URL line; `menu` is a format; bare-string formats are
      accepted alongside the object spelling

## 2. Provider

- [x] 2.1 `provider.ts`: bearer auth, `/v2` baseUrl, timeouts, credit pool,
      vendor-meter `usage.consolidate`, `output.fromError`; no lifecycle
- [x] 2.2 `schema/common.ts`: the OpenAPI `ScrapeOptions` mirror plus
      `zScrapeFormat`, `zParser`, `zAction`, `zLocation`,
      `zRedactPIIOptions`, `zThreatProtectionOverride`, `zAuditMetadata`,
      `zWebhook`

## 3. Endpoints (6)

- [x] 3.1 `scrape` — mirror + 13-component composite + estimate/evidence
- [x] 3.2 `map` — mirror + flat PER_CALL (quantities fns synthesized)
- [x] 3.3 `search` — mirror, `limit` required, block rate + per-result stack
- [x] 3.4 `crawl` — mirror, `limit` required, per-page stack, lifecycle
- [x] 3.5 `batch-scrape` — mirror, per-URL `x_routing`, lifecycle
- [x] 3.6 `agent` — mirror, `maxCredits` required, CREDIT model, lifecycle

## 4. Fixtures + tests

- [x] 4.1 Record real chains for all six endpoints via `deno task record`
- [x] 4.2 Hand-minimize into 9 provider-level shared chains (strategy v2):
      scrape-ok, scrape-pdf-ok, map-ok, search-ok, job-succeeded,
      job-paginated, job-failed, agent-succeeded, provider-error
- [x] 4.3 Per-endpoint replay tests for scrape / map / search (happy,
      provider-error, usage + mismatch, mirror fidelity, binding gates)
- [x] 4.4 Provider-level `lifecycle.test.ts`: job chains across all three
      async docs, fn-interning provenance, sync docs carry no lifecycle
- [x] 4.5 `deno task test:live` green against a real key

## 5. Wiring + docs

- [x] 5.1 README connector row
- [x] 5.2 Verify: fmt · lint · check · test · double-compile byte-identity ·
      version:check · catalog smoke · estimate spot-checks against the
      published credit table
