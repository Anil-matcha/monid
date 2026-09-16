# clay-connector (delta)

## ADDED Requirements

### Requirement: Clay provider definition with three credit pools and one routine lifecycle
The clay provider SHALL declare name `clay`, `request.baseUrl`
`https://api.clay.com/public/v0`, auth `presets.auth.header("clay-api-key")`,
timeouts 60 s request / 300 s run / 5 s poll, the three credit pools
`data_credit`, `action` and `search_result`, and a provider-level
`lifecycle.start`/`lifecycle.poll` implementing the Clay-managed routine
protocol. It SHALL declare no `usage.consolidate`, no `output.fromResponse`
and no `output.fromError`.

#### Scenario: Routine submit and poll
- **WHEN** an enrichment endpoint runs
- **THEN** `start` SHALL POST the doc's compiled request with the caller's
  body wrapped as `{items: [{id, inputs}]}`, park RUNNING on a
  `routine_run_id`, and `poll` SHALL GET
  `/public/v0/routines/run/{id}/results?limit=100`

#### Scenario: Exactly three poll statuses keep the run alive
- **WHEN** a poll answers `202` (Clay's pending signal), `429` (rate limit)
  or any `5xx` (upstream infrastructure)
- **THEN** the run SHALL stay RUNNING, bounded by `runMs`
- **AND WHEN** a poll answers anything else — `200`, or a terminal non-2xx
  such as `400`, `401`, `402`, `404` — the run SHALL complete

#### Scenario: Each doc narrows to the pools it drains
- **WHEN** the bundle is compiled
- **THEN** `clay#enrichment/mobile-phone` SHALL carry credits
  `data_credit` + `action`, `clay#search/query-mode/run` SHALL carry
  `search_result`, and the two FREE search docs SHALL carry none

### Requirement: Ten endpoints in two families
The connector SHALL expose exactly ten endpoints: `search/query-mode/reference`
and `search/query-mode` (FREE), `search/query-mode/run` (PER_UNIT·RESULT
drawing `search_result` at 1 per row), and seven `enrichment/*` docs whose
COMPOSITE models pair one `data_credit` line and one `action` line per
quantum at the drill-measured per-run draws.

#### Scenario: Search rows draw the annual quota
- **WHEN** `POST /search/query-mode/{search_id}/run` with `limit: 2` returns
  2 rows
- **THEN** usage SHALL be `{credits: {search_result: 2}, evidence:
  {RESULT: 2}}` with no `mismatch`, and `period_quota` SHALL remain on the
  output

#### Scenario: An exhausted iterator draws nothing
- **WHEN** a run returns `data: []`
- **THEN** usage SHALL be `{credits: {}, evidence: {RESULT: 0}}`

#### Scenario: Creating and reading the grammar are free
- **WHEN** `POST /search/query-mode` or `GET /search/query-mode/reference`
  succeeds
- **THEN** usage SHALL be `{credits: {}, evidence: {}}`

### Requirement: Enrichment settles on completed, non-empty items
An enrichment run SHALL count an item toward its hit lines only when the item
reports `status: "complete"` AND its `result` holds at least one value that is
not null, not an empty string and not an empty object. A `failed` item SHALL
count toward no line.

#### Scenario: A hit settles the doc's pinned per-run draw
- **WHEN** `/enrichment/work-email` completes with a non-empty result
- **THEN** usage SHALL be `{credits: {data_credit: 0.6, action: 2},
  evidence: {enrichment_credits: 1, enrichment_actions: 1}}`

#### Scenario: A miss is free on six of the seven functions
- **WHEN** `/enrichment/company-domain`, `-employee-count`, `-industry`,
  `-job-openings`, `/work-email` or `/person` completes with an all-empty
  result
- **THEN** usage SHALL be `{credits: {}, evidence: {enrichment_credits: 0,
  enrichment_actions: 0}}`

#### Scenario: Mobile Phone prices its miss
- **WHEN** `/enrichment/mobile-phone` completes with an empty result
- **THEN** usage SHALL be `{credits: {data_credit: 0.5, action: 1},
  evidence: {enrichment_credits: 0, enrichment_actions: 0, miss_credits: 1,
  miss_actions: 1}}`

#### Scenario: A failed item draws nothing
- **WHEN** a run completes with an item whose `status` is `failed`
- **THEN** every evidence line SHALL be 0 and credits SHALL be `{}`

### Requirement: Estimates are deduced from the caller's stated bound
Every metered doc SHALL resolve a `usage.estimate` that reads only the
validated input. The enrichment estimate SHALL promise one enrichment (the
hit arm — mobile-phone's worst case); the search-run estimate SHALL promise
the caller-stated `limit`, which is REQUIRED at the binding.

#### Scenario: A search run without a limit is rejected before the wire
- **WHEN** `/search/query-mode/run` is called with no `limit`, a `limit`
  outside 1-500, or an unknown body key
- **THEN** the run SHALL fail `INVALID_INPUT` with no upstream call

### Requirement: Enrich Person requires at least one identifier
Clay declares neither `Professional Profile URL` nor `Email` required, but a
body with neither starts a run that resolves nobody and can still draw. The
doc SHALL bind a constraint that survives compilation — an `anyOf` whose arms
each require one identifier — so the engine rejects such a body before the
wire. A zod refinement SHALL NOT be used: `z.toJSONSchema` drops refinements
silently, so the compiled doc would enforce nothing.

#### Scenario: A body with no identifier never reaches Clay
- **WHEN** `/enrichment/person` is called with `{}`
- **THEN** the run SHALL fail `INVALID_INPUT` with no upstream call and no
  draw

#### Scenario: Either identifier alone suffices
- **WHEN** `/enrichment/person` is called with only `Professional Profile
  URL`, only `Email`, or both
- **THEN** the run SHALL proceed

#### Scenario: The estimate performs no IO
- **WHEN** an enrichment doc is estimated with a transport that rejects every
  request
- **THEN** the estimate SHALL return `{enrichment_credits: 1,
  enrichment_actions: 1}` and its credits SHALL equal the independently
  MEASURED hit draw for that endpoint — not a figure re-derived from the
  doc's own model, which would hold whatever the model happened to say

### Requirement: The workspace quota ledger never reaches the caller
Every successful search page carries `period_quota` — the limit, consumption
and reset date of the WORKSPACE, which one Clay account shares across all
tenants. The connector SHALL strip it from user-facing output. It SHALL NOT be
lifted as a vendor claim: it is a cumulative ledger, not a per-call draw.

#### Scenario: The ledger is stripped, the page is not
- **WHEN** a search run returns rows alongside `period_quota`
- **THEN** the output SHALL retain `data`, `has_more`, `source_type` and
  `exhaustion_reason`, and SHALL NOT contain `period_quota`

#### Scenario: Stripping cannot change a bill
- **WHEN** the strip runs
- **THEN** usage SHALL already have settled on the RAW envelope, so the rows
  drawn are unaffected

### Requirement: Terminal vendor answers relay verbatim
A TERMINAL Clay non-2xx SHALL complete the run as a provider error with zero
usage and the vendor's own body unchanged — including the HTTP 402 whose text
names the subscription's quota cap. Terminality differs by hook: on `start`
every non-2xx is terminal (there is no retry arm); on `poll` every non-2xx
except `202`, `429` and `5xx`, which keep the run RUNNING.

#### Scenario: A rejected start is data
- **WHEN** the routine start answers 401
- **THEN** the run SHALL be COMPLETED with `httpStatus` 401,
  `isProviderError` true, usage `{credits: {}, evidence: {}}`, the body
  relayed, and nothing polled

#### Scenario: An expired search is data
- **WHEN** `/search/query-mode/run` is called with an expired `search_id`
- **THEN** the run SHALL complete 404 with the body
  `{message: "Search not found or expired"}` and zero usage

### Requirement: Operational caveats ride `meta.notes`
Facts a caller must know BEFORE calling SHALL be stated as `meta.notes`
entries, not buried in `meta.description`: what is metered, how long a miss
takes, when a handle expires, and where an endpoint answers plausibly rather
than correctly. `meta.description` SHALL carry capability text and
cross-endpoint chaining guidance only.

#### Scenario: The charged miss is a note, not prose
- **WHEN** `clay#enrichment/mobile-phone`'s compiled meta is read
- **THEN** `notes` SHALL state that a miss is charged and name both draws,
  and `description` SHALL NOT repeat it

#### Scenario: A compile-surviving rule is not a note
- **WHEN** `clay#enrichment/person`'s compiled meta is read
- **THEN** the at-least-one-identifier rule SHALL be absent from `notes` —
  it rides the input schema's `anyOf`, which notes are not for

### Requirement: Public identities and unexposed routine ids
Each enrichment doc SHALL bake its Clay-managed routine id into
`request.path` percent-encoded, and pin a public identity under
`/enrichment/`. The search-run doc SHALL keep the `{search_id}` placeholder
in its compiled url while pinning the brace-free identity
`/search/query-mode/run`.

#### Scenario: No routine id is addressable by callers
- **WHEN** any clay doc's compiled input schema is read
- **THEN** it SHALL contain no `routine_id` field
