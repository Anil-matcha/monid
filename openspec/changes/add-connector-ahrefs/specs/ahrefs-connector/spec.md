# ahrefs-connector (delta)

## ADDED Requirements

### Requirement: Ahrefs provider definition with one API-unit pool
The ahrefs provider SHALL declare name `ahrefs`, `request.baseUrl`
`https://api.ahrefs.com/v3`, `request.headers` `{Accept: application/json}`,
auth `presets.auth.bearer()`, timeouts 30 s request / 60 s run, the single
credit pool `default` ("Ahrefs API units"), and a provider-level
`output.fromError` digesting `{ error: string }`. It SHALL declare no
`usage.consolidate`, no `output.fromResponse`, no `input.toRequest` and no
lifecycle.

#### Scenario: The rows counter is one fn
- **WHEN** the bundle is compiled
- **THEN** all 36 ahrefs docs SHALL share one `usage.evidence` fn key and
  every doc's `usage.credits` SHALL be exactly `{default}`

### Requirement: Thirty-six endpoints billing the vendor formula
The connector SHALL expose exactly 36 endpoints whose ids are the v3 paths
(`site-explorer/*` ×28, `keywords-explorer/*` ×6, `serp-overview/serp-overview`,
`batch-analysis/batch-analysis`). Every model SHALL be COMPOSITE with a
`rows` line (PER_UNIT·RESULT, `amount` = the endpoint's units per row) and a
`minimum_top_up` line (PER_UNIT·CREDIT, `amount` 1). `usage.evidence` SHALL
count the first array in the body as rows (an object body as one row) and
put `max(0, 50 − units × rows)` on the top-up.

#### Scenario: Three backlinks at 10 units each
- **WHEN** `GET /site-explorer/all-backlinks` with `limit: 3` returns three
  rows
- **THEN** usage SHALL be `{credits: {default: 50}, evidence: {rows: 3,
  minimum_top_up: 20}}`

#### Scenario: A full page clears the minimum
- **WHEN** 100 backlink rows return
- **THEN** usage SHALL be `{credits: {default: 1000}, evidence: {rows: 100,
  minimum_top_up: 0}}`

#### Scenario: An empty result still draws the minimum
- **WHEN** a rowed report returns `[]`
- **THEN** usage SHALL be `{credits: {default: 50}, evidence: {rows: 0,
  minimum_top_up: 50}}`

#### Scenario: A snapshot is one row
- **WHEN** `GET /site-explorer/metrics` returns `{ metrics: {...} }`
- **THEN** usage SHALL be `{credits: {default: 50}, evidence: {rows: 1,
  minimum_top_up: 6}}` (44 units per row)

#### Scenario: Errors are data
- **WHEN** upstream answers 400 `{ error: "invalid filter" }`
- **THEN** the run SHALL complete as a provider error with usage
  `{credits: {}, evidence: {}}` and output `{message: "invalid filter",
  raw: {...}}`

### Requirement: Fixed field sets on the wire and in the schema
Every endpoint with a `select` SHALL inject its fixed field list in
`input.toRequest` (comma-joined query on GET, array in the POST body);
Keywords Explorer endpoints SHALL also join `keywords` onto a
comma-separated parameter. `where` and `order_by` SHALL compile to JSON
Schema `pattern`s that accept only the endpoint's field set.

#### Scenario: An out-of-set filter field never reaches the wire
- **WHEN** `/site-explorer/all-backlinks` is called with
  `where: {"field":"traffic","is":["gt",100]}` or `order_by: "traffic"`
- **THEN** the run SHALL fail with INVALID_INPUT and no request SHALL be
  issued
- **AND WHEN** `where` is `{"field":"first_seen","is":["gte","2025-01-01"]}`
  and `order_by` is `first_seen:desc`
- **THEN** the request SHALL be issued with `select` appended

### Requirement: Estimates are deduced from the request
`usage.estimate` SHALL promise `limit` rows (rowed reports), 1 (snapshots),
250 (`metrics-by-country`), `keywords.length` (`keywords-explorer/overview`),
`top_positions` (`serp-overview`), `targets.length` (`batch-analysis`), or
the bucket anchors inside the inclusive range `date_from` to `date_to`
(history: every day, Mondays, or firsts of months by `history_grouping`;
`volume-history`: firsts of months), with the top-up derived from the doc's
own per-row rate. An inverted range has zero anchors.

#### Scenario: A monthly history range
- **WHEN** `/site-explorer/metrics-history` is estimated with `date_from
  2026-01-01`, `date_to 2026-03-31` (monthly)
- **THEN** the estimate SHALL be `{credits: {default: 63}, evidence: {rows:
  3, minimum_top_up: 0}}` (21 units per row)

### Requirement: Input gates
Every schema SHALL be `.strict()`. `limit` (1–100) and `top_positions`
(1–100) SHALL be required where present; `volume-by-country` `limit` is
1–250. History bindings SHALL require `date_to`. Dates SHALL be ISO
`YYYY-MM-DD` (`format: date`).

#### Scenario: A missing row budget is rejected
- **WHEN** `/site-explorer/refdomains` is called without `limit`, or with
  `limit: 101`
- **THEN** the run SHALL fail with INVALID_INPUT
