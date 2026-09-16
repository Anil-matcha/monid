# firecrawl-connector (delta)

## ADDED Requirements

### Requirement: Firecrawl provider definition with the shared vendor meter
The firecrawl provider SHALL declare name `firecrawl`, `request.baseUrl`
`https://api.firecrawl.dev/v2`, auth `presets.auth.bearer()`, timeouts 30 s
request / 60 s run, credit pool `default` ("Firecrawl credits"), a
provider-level `usage.consolidate` that reads the vendor's own `creditsUsed`
claim — plucking the bare top-level field out of the output and falling back
to `data.metadata.creditsUsed` — and a provider-level `output.fromError` that
normalizes `{success, error, code?}` into `{message, code?, raw}`. The
provider SHALL NOT declare a lifecycle.

#### Scenario: Claim wins and agrees
- **WHEN** `POST /scrape` returns a document whose
  `data.metadata.creditsUsed` is 1
- **THEN** usage is `{credits: {default: 1}, evidence: {page: 1}}` with no
  `mismatch`, and the nested meter stays in the output as page provenance

#### Scenario: Bare receipt is plucked away
- **WHEN** `POST /search` returns a top-level `creditsUsed: 2`
- **THEN** the claim is `{default: 2}` and `creditsUsed` is absent from the
  output

#### Scenario: Absent meter falls back to the fold
- **WHEN** `POST /map` returns `{success, id, links}` with no meter
- **THEN** the claim is omitted and the derived flat 1 settles the run

#### Scenario: Vendor non-2xx is zero-billed data
- **WHEN** any endpoint receives a 402 `{success: false, error}`
- **THEN** `isProviderError` is true, usage is
  `{credits: {}, evidence: {}}`, and the output is
  `{message, raw}`

### Requirement: Inputs mirror the published v2 OpenAPI without translation
Every `schema/inputs.ts` SHALL mirror its OpenAPI request schema with
optionality only — no `.default()`, no invented fields, no `.strict()` — and
no endpoint SHALL declare `input.toRequest`. Where the API accepts both a
bare-string and a `{type}` object spelling for an option-less union member —
`formats`, `sources` and `categories` — the mirror SHALL accept both, and
usage fns SHALL read the native shapes directly.

#### Scenario: No invented scalars
- **WHEN** the compiled `firecrawl#scrape` body schema is inspected
- **THEN** it carries `formats`, `parsers`, `redactPII` and `lockdown`, and
  carries no `json`, `jsonSchema` or `jsonPrompt` field

#### Scenario: The validated input is the wire body
- **WHEN** any firecrawl doc is inspected
- **THEN** `input.toRequest` is undefined

#### Scenario: Both vendor spellings validate
- **WHEN** `firecrawl#search` runs with `sources: ["web"]` or
  `sources: [{type: "web"}]`, or with `categories: ["research"]` or
  `categories: [{type: "research"}]`
- **THEN** each is accepted and priced identically

### Requirement: Primary limiting knobs are required at the binding
`firecrawl#search` SHALL require `limit`, `firecrawl#crawl` SHALL require
`limit`, and `firecrawl#agent` SHALL require `maxCredits`, each derived from
the faithful mirror at the endpoint def even though the vendor publishes a
default. `firecrawl#batch/scrape` SHALL leave `urls` untightened, and
`firecrawl#map` SHALL leave `limit` optional because it is flat-rated.

#### Scenario: Unbounded crawl is refused before the wire
- **WHEN** `firecrawl#crawl` runs without `limit`
- **THEN** the run fails INVALID_INPUT before any wire call

### Requirement: Every input-gated surcharge is a modeled billing line
`firecrawl#scrape`, `firecrawl#crawl` and `firecrawl#batch/scrape` SHALL price
a COMPOSITE whose components name each published per-page surcharge: `json`,
`question`, `highlights`, `audio`, `video`, `redact_pii`,
`prompt_injection_check` and `lockdown` at 4 credits; `zero_data_retention` at
1; `threat_protection_scan` at 2; `x_routing` at 29; `pdf_page` at 1; plus the
base page. `firecrawl#search` SHALL price `search_block` as PER_UNIT·RESULT
with `every: 10` at 2 credits, a `zdr_search` delta of 8, and the same page
stack per scraped result.

#### Scenario: JSON format quintuples a scrape
- **WHEN** `firecrawl#scrape` is estimated with
  `formats: [{type: "json"}]`
- **THEN** the estimate is 5 credits with evidence `{json: 1, page: 1}`

#### Scenario: X routing is 30, and 34 with extraction
- **WHEN** `firecrawl#scrape` is estimated for an `x.com` or `twitter.com`
  URL, with and without a `json` format
- **THEN** the estimates are 30 and 34 credits

#### Scenario: Search block rate rounds up
- **WHEN** `firecrawl#search` is estimated with `limit: 10` and `limit: 11`
- **THEN** the estimates are 2 and 4 credits

#### Scenario: `limit` is per source, so sources multiply the estimate
- **WHEN** `firecrawl#search` is estimated with `limit: 10` and three distinct
  `sources`
- **THEN** the estimate is 30 results and 6 credits, matching the vendor
- **AND** a repeated source entry does not multiply, because the response is
  keyed by source name and cannot carry a second array for it
- **AND** `categories` never multiply, because they filter the same result set

#### Scenario: PDF pages offset the base fee
- **WHEN** a scrape returns `metadata.numPages: 3`
- **THEN** evidence is `{pdf_page: 2, page: 1}` and the fold is 3 credits

#### Scenario: Batch counts X routing per URL
- **WHEN** `firecrawl#batch/scrape` is estimated with one `x.com` URL and one
  ordinary URL
- **THEN** the estimate is 31 credits, not 2 or 60

#### Scenario: X routing settles on delivered rows, not the request
- **WHEN** a batch is given an `x.com` URL and an ordinary URL but delivers
  only the ordinary one
- **THEN** evidence carries no `x_routing` line, because the Grok charge
  applies to pages Firecrawl actually fetched
- **AND** the estimate still counts it, because the request list is all a
  pre-run promise can read

#### Scenario: Output-determined lines are not guessed
- **WHEN** any endpoint is estimated
- **THEN** `pdf_page` is absent from the estimate, and `x_routing` is absent
  from a `firecrawl#search` estimate

### Requirement: One job lifecycle shared by the three async endpoints
`firecrawl#crawl`, `firecrawl#batch/scrape` and `firecrawl#agent` SHALL each
declare `lifecycle.start`/`poll`/`stop` whose sources are byte-identical, so
the compiler interns one fnTable entry per phase. `start` SHALL relay the
compiled request and park RUNNING on the returned `id`, returning a non-2xx as
COMPLETED data and throwing only when a 2xx carries no id. `poll` SHALL treat
`scraping`, `processing` and an absent status as RUNNING, `completed` as
COMPLETED 200, and any other status as COMPLETED with a synthesized
`httpStatus` 500 and `providerHttpStatus` 200. A status LOOKUP answering 408,
429, 500, 502, 503 or 504 — the set Firecrawl documents as retryable — SHALL
be treated as RUNNING with a backed-off `pollAfterMs` rather than as a
terminal run, because the job is still executing and still accruing charges
and a settled run cannot be resumed. `stop` SHALL DELETE the status URL
best-effort.

#### Scenario: A transient status lookup does not settle the run
- **WHEN** two consecutive status lookups answer 429 and 503 before the job
  reports `completed`
- **THEN** the run settles 200 on the completed body with the vendor's usage,
  and is never classified as a provider error

#### Scenario: One interned fn per phase
- **WHEN** the compiled bundle is inspected
- **THEN** the three endpoints' `lifecycle.start`, `poll` and `stop` `$fn`
  keys are pairwise equal, and the three sync endpoints carry no lifecycle

#### Scenario: In-body job failure is zero-billed
- **WHEN** a status body reports `status: "failed"` on HTTP 200
- **THEN** the result is `httpStatus` 500, `providerHttpStatus` 200, and usage
  is `{credits: {}, evidence: {}}`

#### Scenario: Settle on the vendor's page count
- **WHEN** a job completes with `completed: 2` and `creditsUsed: 2`
- **THEN** usage is `{credits: {default: 2}, evidence: {page: 2}}` with no
  mismatch

### Requirement: Paginated job results are followed, not handed back
When a terminal status body carries `next`, `lifecycle.poll` SHALL follow the
cursor through the engine transport and concatenate each page's `data`,
bounded at 20 pages, returning the accumulated rows on the first envelope and
leaving `next` in the output ONLY when that bound is hit. A non-array `data`
SHALL short-circuit the walk and return the envelope untouched.

#### Scenario: Two-page result set is returned whole
- **WHEN** a job completes with `next` pointing at one further page of 1 row
  after 2 rows
- **THEN** the output holds 3 rows and carries no `next`

#### Scenario: Agent object result is left alone
- **WHEN** `firecrawl#agent` completes with `data` as a single object
- **THEN** the output's `data` is that object, and usage is
  `{credits: {default: n}, evidence: {CREDIT: n}}` for the reported
  `creditsUsed`
