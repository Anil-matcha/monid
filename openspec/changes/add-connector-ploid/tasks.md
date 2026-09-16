# Tasks: add-connector-ploid

## 1. Provider + categories

- [x] 1.1 provider.ts: bearer auth, baseUrl, timeouts, one `default` ACU
      pool, two-field meter consolidate + v1 meta strip
- [x] 1.2 categories.ts: `agents` leaf

## 2. Endpoints (10)

- [x] 2.1 search / linkedin-search: block model (`every: 10`), required
      page knob, delivered-rows evidence
- [x] 2.2 socials + five flat LinkedIn reads: PER_CALL (1 ACU / 0.06 ACU)
- [x] 2.3 enrich: COMPOSITE found-only lines, vendor-default enrichments
- [x] 2.4 agent: endpoint-level lifecycle (start / poll / state), pinned
      fields in toRequest, `max_acu` default 2, CREDIT meter

## 3. Fixtures + tests

- [x] 3.1 Recorded: provider-error (real 401) for all ten endpoints
- [x] 3.2 Synthetic: search happy / empty, socials, enrich happy / empty,
      agent run-succeeded / error-inside-200 / run-failed, six LinkedIn
      happies
- [x] 3.3 Tests: provenance, happy / empty / 401 / 200-error / schema
      gates per endpoint, live gated on PLOID_API_KEY
- [ ] 3.4 Replace the synthetic fixtures via `deno task record` when
      PLOID_API_KEY exists; confirm the agent 202 envelope and a real
      personal-email fallback run (D3)

## 4. Wiring + docs

- [x] 4.1 README connector row
- [x] 4.2 Verify: fmt · lint · check · test · double-compile · version:check
      · catalog smoke
