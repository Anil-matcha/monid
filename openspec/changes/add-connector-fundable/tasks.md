# Tasks: add-connector-fundable

## 1. Provider

- [x] 1.1 provider.ts: bearer auth, baseUrl, timeouts, credit pool,
      consolidate (pluck credits_used + deep strip), generic evidence
- [x] 1.2 schema/common.ts: shared zod fragments (PAGE_SIZE_MAX, uuid, date,
      pagination, permalinks, financing types, identifiers)

## 2. Endpoints (17)

- [x] 2.1 Row-billed ×7 with page_size binding + estimate
- [x] 2.2 Flat lookups ×5 (`/deal`, `/deal/investors` identities pinned)
- [x] 2.3 Fuzzy resolvers ×3 at 0.1 credit
- [x] 2.4 FREE permalink resolvers ×2

## 3. Fixtures + tests

- [x] 3.1 Synthetic fixtures for deals / company / deal-investors /
      company-search / location-search
- [x] 3.2 Tests: provenance (17 docs share provider fns; estimates own vs
      synthesized; compiled urls keep `{id}`), happy / empty / provider-error
      / schema-gate per representative endpoint, live gated
- [ ] 3.3 Replace synthetic fixtures via `deno task record` when
      FUNDABLE_API_KEY exists; run test:live

## 4. Wiring + docs

- [x] 4.1 README connector row
- [x] 4.2 Verify: fmt · lint · check · test · double-compile · version:check
      · catalog smoke
