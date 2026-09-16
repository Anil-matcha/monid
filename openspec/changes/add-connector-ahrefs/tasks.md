# Tasks: add-connector-ahrefs

## 1. Provider + shared schema

- [x] 1.1 provider.ts: bearer auth, v3 baseUrl + Accept header, timeouts
      (30/60), one pool (`default` = API units), fromError; no consolidate
- [x] 1.2 schema/common.ts: target / mode / protocol / limit / country /
      dates / grouping / keywords fragments (no defaults), `zOrderBy` and
      `zWhere` as field-set PATTERNS (D4)
- [x] 1.3 categories.ts: `seo` and `geo` leaves (manifest names)

## 2. Endpoints (36)

- [x] 2.1 Site Explorer ×28 (backlinks, organic/paid, pages, outgoing,
      overview snapshots, history): fixed `select` in toRequest, COMPOSITE
      rows + minimum_top_up (D1), generic evidence (D3), family estimates
- [x] 2.2 Keywords Explorer ×6: `keywords` array joined onto the wire;
      volume-history monthly buckets; volume-by-country limit 1–250
- [x] 2.3 SERP Overview: `top_positions` REQUIRED
- [x] 2.4 Batch Analysis: JSON POST, `select` array in the body, per-target
      mode/protocol defaults, rows = targets.length
- [x] 2.5 Bindings: limit / top_positions / history date_to REQUIRED;
      mode / protocol / history_grouping vendor defaults (D5, D6)
- [x] 2.6 v1 billing notes → `meta.notes` (units per row, 50 minimum,
      field-set restriction, 60-bucket cap)

## 3. Fixtures + tests

- [x] 3.1 Synthetic fixtures (happy / empty / provider-error) per endpoint,
      URLs produced by the engine with a stub fetch (D8)
- [x] 3.2 36 endpoint.test.ts: usage deep-equal per scenario, schema gates
      (field-set patterns, required budgets, date_to), live gated on
      AHREFS_API_KEY; provider-wide tests (36 ids, the units-per-row literal
      table, one evidence fn, one pool) in site-explorer/all-backlinks
- [ ] 3.3 Obtain an Ahrefs key: `deno task test:live`, then `deno task
      record` and replace the synthetic fixtures — confirm the collection
      key per endpoint, the snapshot object shapes, and whether the vendor
      caps history at 60 buckets
- [ ] 3.4 With the key, read the `x-api-units-cost-*` headers on a few
      runs and confirm the 36 units-per-row constants (v1 drill 2026-08)
- [x] 3.5 PR #20 / #21 review: confirm monthly / weekly / daily anchors
      through Monid-dev live runs (2026-09-16), fix all eight history
      estimates, and cover date boundaries plus a hold above the minimum.
      Re-derive all 36 rates from the vendor field descriptions and record
      each source URL, field-cost breakdown, and verification date.

## 4. Follow-ups

- [ ] 4.1 Vendor claim from the cost header (D2): confirm the header name
      live, then move the 36 docs to a provider `lifecycle.start` that
      stashes it into `state.data` for a consolidate — gives every run a
      `usage.mismatch.derived` guard on the constants
- [ ] 4.2 Broker: decide whether the 50-unit request minimum passes to the
      caller (the doc now reports it; v1 absorbed it — D1)

## 5. Docs + verify

- [x] 5.1 openspec: proposal, design D1–D9, spec, tasks
- [x] 5.2 Verify: fmt · lint · check · test · double-compile ·
      version:check · catalog endpoints (36) · engine:estimate spot checks
