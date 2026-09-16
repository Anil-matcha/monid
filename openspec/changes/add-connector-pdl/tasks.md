# Tasks: add-connector-pdl

## 1. Provider + schemas

- [x] 1.1 provider.ts: X-Api-Key auth, baseUrl, timeouts, the FOUR credit
      pools (one per `x-call-credits-type`), generic evidence (no
      consolidate — meter is header-only)
- [x] 1.2 schema/common.ts: shared enrichment/search fragments; refinement
      rules documented in describes

## 2. Endpoints (4)

- [x] 2.1 person-enrich / company-enrich: GET + queryParams, PER_CALL 1
      credit
- [x] 2.2 person-search / company-search: POST + body union, size required,
      PER_UNIT 1 credit/record, estimate = size
- [x] 2.3 person-search `dataset`: a STRING carrying PDL's list/exclusion
      grammar in its describe, not v1's `z.enum` (which rejected the
      vendor's own valid values at our gate) — PR #7 review, design D7

## 3. Fixtures + tests

- [x] 3.1 Synthetic fixtures (enrich happy + 404, search happy + empty,
      company flat envelope)
- [x] 3.2 Tests: provenance + pool + wire form, happy / empty / 404 /
      schema gates (size required, query XOR sql), live gated
- [ ] 3.3 Replace synthetic fixtures via `deno task record` when
      PDL_API_KEY exists; confirm `x-call-credits-type` per endpoint maps to
      its pool per the D2 table (enrich → people_enrich, search →
      people_search, enrich_company → company_enrich, search_company →
      company_search) and `x-call-credits-spent` is 1 per record / match

## 4. Wiring + docs

- [x] 4.1 README connector row
- [x] 4.2 Verify: fmt · lint · check · test · double-compile · version:check
      · catalog smoke

## 5. Compiler: credits per declaration site (design D6)

- [x] 5.1 compile.ts: credits resolve KEY-WISE endpoint over provider;
      endpoint-declared pools drained by that endpoint; provider-declared
      pools drained by ≥1 endpoint (post-pass per provider); compiled doc
      narrowed to the pools its lines drain
- [x] 5.2 Contract comments corrected (`sections/usage.ts`,
      `usage/model/consumes.ts`) + engine 0.0.1 → 0.0.2 (comment-only
      CONTRACT_PATH touch; `doc_format_since`/`fn_abi_since` unchanged)
- [x] 5.3 compiler.test.ts: provider pool undrained by ANY endpoint fails;
      the multi-pool provider compiles (each doc narrowed); endpoint pool
      undrained by its own lines fails; key-wise endpoint override; the
      FREE-credits test regrouped around a billable sibling
- [x] 5.4 connector-schema MODIFIED delta + AGENT.md rule line

## 6. Follow-ups out of this change (design D7)

- [ ] 6.1 ENGINE: repeated-param query encoding (`location=A&location=B`)
      — `toScalarQuery` rejects arrays today, so PDL's multi-value
      enrichment parameters stay single-valued. Its own change, with the
      RunInput/queryParams contract and a spec requirement.
