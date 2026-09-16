# Proposal: add-connector-ahrefs

## Why

Ahrefs (ahrefs.com) is a live v1 monid-services provider — 36 synchronous
endpoints of SEO and backlink intelligence: Site Explorer (28), Keywords
Explorer (6), SERP Overview (1), Batch Analysis (1). It is the first
connector whose vendor bills in a formula with a per-request MINIMUM
(`max(50, units_per_row × rows)` API units) and whose per-row price depends
on WHICH fields a request touches — so every endpoint pins a fixed field
set, and the input schema has to keep a caller's filter and sort inside
that set. Both are expressible today: the minimum is a second COMPOSITE
line whose count is a rule (D19), and the field-set guard is a JSON Schema
`pattern`.

## What Changes

- **connectors/ahrefs** — 36 endpoints on one host
  (`https://api.ahrefs.com/v3`), Bearer auth, GET with query parameters
  except the Batch Analysis JSON POST.
  - **One pool, the vendor formula as two lines (D1).** `default` =
    "Ahrefs API units". Every doc is COMPOSITE `{rows: PER_UNIT·RESULT at
    the endpoint's units per row, minimum_top_up: PER_UNIT·CREDIT at 1}`;
    `evidence` counts the returned rows and puts `max(0, 50 − units × rows)`
    on the top-up, so the fold IS `max(50, units × rows)` — empty result
    included for billable requests. A synchronous provider relay reads
    the actual consumption header for `usage.consolidate`; cached/free
    responses zero both billable counts so explicit zero survives the
    engine's empty-claim fallback (D2).
  - **Fixed field sets (D4).** Each endpoint's `input.toRequest` injects its
    `select` list (comma-joined on GET, array in the POST body); `where` and
    `order_by` are restricted to that list by compiled `pattern`s, so the
    authored units-per-row constant cannot drift.
  - **One generic rows counter** stated verbatim on all 36 endpoints (one
    interned fn) reading the per-row rate off the doc's own model; eight
    estimate shapes (row budget, fixed one row, country list, keyword
    list, top positions, targets, history buckets, monthly buckets).
  - **Bindings (D5, D6):** `limit` / `top_positions` REQUIRED (the hold's
    basis); `mode` / `protocol` / `history_grouping` carry the vendor
    defaults; history `date_to` REQUIRED because a hook fn has no clock.
    v1's history-range `.superRefine` does not survive compilation — the
    60-bucket cap is a note, and the estimate counts the whole range.
  - **Categories:** two new leaves, `seo` and `geo`, named and described
    as in the monid-services taxonomy manifest.
- **Fixtures are SYNTHETIC** — no Ahrefs key is held in this repo. Bodies
  follow the v1 adaptor tests (`{ <collection>: [...] }` / `{ <name>:
  {...} }`), URLs were produced by the engine itself, and every file says so.

## Capabilities

- `ahrefs-connector`.

## Non-goals

- Not ported (v1 scope decisions, unchanged): Brand Radar (11 endpoints,
  pricing never drill-measured, no v1 def exists); the 92 workspace-bound or
  free operations (Management, Rank Tracker, Site Audit, GSC Insights, Web
  Analytics, Social Media, Public, Subscription Info).
- No dollar conversion in the doc: v1's `$0.00129`/unit cost (Lite plan) and
  `$0.003`/unit list rate are the broker card's job (owner rule 2026-09-15).
- **The 50-unit minimum is NOT absorbed here (D1).** v1 absorbed it on the
  platform side (`billAtPublishedRate`); the doc states the vendor's card
  and the broker decides pass-through — the clay D3 posture.
- No `{type, rows}` output envelope (D7): v1 normalized every body for its
  row counter; v2 relays the vendor body verbatim and counts in `evidence`.
- No `output.fromResponse`, no `toRequest` beyond `select` / keyword join.
- No engine, schema or preset change; `ENGINE_VERSION` untouched.

## Impact

New connector tree, two category leaves, `openspec/changes/add-connector-ahrefs`.
The fixture response-header allowlist also retains the actual cost and
cache headers. No schema/engine contract change.
