# Tasks: add-connector-opoint

## 1. Provider + schemas

- [x] 1.1 provider.ts: inline Token inject, baseUrl, timeouts, ARTICLE
      profile toRequest, in-band 200 verdict in lifecycle.start, agreement
      projection in fromResponse, one `default` pool (no consolidate)
- [x] 1.2 schema/common.ts: searchterm, article ref, params allow-list

## 2. Endpoints (5)

- [x] 2.1 search / search-advanced: inherit everything; pinned identity
- [x] 2.2 search-headlines: HEADLINE profile override
- [x] 2.3 search-by-ids: profile + select_by_ids + requestedarticles = ids
- [x] 2.4 suggest: public host, passthrough inject, query → path segments,
      row projection, FREE

## 3. Fixtures + tests

- [x] 3.1 Recorded: suggest happy + empty (public host); search ×4
      provider-error (real 401, captures each wire profile)
- [x] 3.2 Synthetic: search happy / empty / in-band-error; headlines,
      advanced, by-ids happy
- [x] 3.3 Tests: provenance, happy / empty / 422 / 401 / schema gates per
      endpoint, live gated on OPOINT_API_KEY
- [ ] 3.4 Replace the synthetic search fixtures via `deno task record`
      when OPOINT_API_KEY exists; confirm a real in-band 200 failure shape

## 4. Wiring + docs

- [x] 4.1 README connector row
- [x] 4.2 Verify: fmt · lint · check · test · double-compile · version:check
      · catalog smoke
