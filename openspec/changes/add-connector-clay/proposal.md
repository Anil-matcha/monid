# Proposal: add-connector-clay

## Why

Clay (clay.com) is a proven v1 monid-services provider — 10 live endpoints of
GTM data across two shapes: a query-language search over a proprietary
people/company database (sync) and seven curated Clay-managed enrichment
functions (async submit → 202 → poll). It is the first connector whose vendor
meters against SEVERAL independent pools at once, and the first whose billing
has a genuine per-outcome split (one function charges on a miss). Both are
expressible today: the pdl key-wise credits fix landed the multi-pool
declaration, and D19's "conditions are counting rules, never model shapes"
covers the outcome split.

## What Changes

- **connectors/clay** — 10 endpoints, all inheriting the provider's
  `clay-api-key` auth, timeouts (request 60 s / run 300 s / poll 5 s), the
  three credit pools, and the routine lifecycle.
  - 7 curated enrichment docs (`/enrichment/company-domain`,
    `-employee-count`, `-industry`, `-job-openings`, `/work-email`,
    `/person`, `/mobile-phone`): COMPOSITE, one PER_UNIT line per pool per
    quantum, at the v1 drill-measured per-run draws. Each bakes its
    Clay-managed routine id into `request.path`; the raw
    `/routines/{routine_id}/run` surface stays unexposed.
  - `mobile-phone` alone prices TWO quanta — a hit (10.0 data credits +
    2 actions) and a miss (0.5 + 1) — and owns the two-armed
    `usage.evidence` that partitions them.
  - 3 search docs: `/search/query-mode/reference` and `/search/query-mode`
    are FREE; `/search/query-mode/run` is PER_UNIT·RESULT drawing the
    annual results quota one row at a time.
- **The lifecycle lives on the provider** (routine start + poll); the three
  search docs override `start` with a plain relay, because `lifecycle.poll`
  only resolves when a `start` does.
- **`search_id` becomes a `pathParams` slot** (v1 carried it in the body and
  re-homed it inside a hook); the public identity stays the v1 id
  `/search/query-mode/run`.
- **Fixtures are real recordings** (2026-09-16, `CLAY_API_KEY`), hand-
  minimized into four shared enrichment chains plus six per-endpoint search
  fixtures, and sanitized of our account's quota watermark and of real
  people.

## Capabilities

- `clay-connector`.

## Non-goals

- Not ported: the batch trio (`run-batch/upload-url|start|results` — a JSONL
  file lifecycle with short-lived result URLs), `POST /tables/query`
  (Enterprise-only), `GET /me` (key health check), the deprecated
  filters-mode search (Clay's own docs redirect to query-mode), and the
  seven uncurated company functions v1 left for demand.
- No dollar conversion in the doc. Clay's units are data credits, actions
  and quota rows; the Launch-plan rates ($0.046 / $0.004 / bundled) are the
  broker card's job (owner rule 2026-09-15).
- No new category leaves: `people-enrichment`, `company-enrichment` and
  `jobs` already exist.
- No drift suite: Clay publishes no machine-readable pricing surface, and
  no response carries a meter, so there is no per-run `mismatch` signal
  either. The rates are held by literal expectations in the tests (design
  D7a) — a replay case per endpoint plus one live enrichment run — and
  re-measured by the monthly `clay credits balance` reconciliation, as in
  v1.

## Impact

New connector tree + README row. No schema/engine contract change —
`ENGINE_VERSION` unchanged, no new `Unit`, no new preset, no new hook. Two
v1 behaviours are deliberately dropped (the HTTP 402 body substitution and
the `period_quota` strip), so clay declares no output hooks at all.
