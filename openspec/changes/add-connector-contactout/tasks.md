# Tasks: add-connector-contactout

## 1. Provider + shared schema

- [x] 1.1 provider.ts: two-key credential shape (no inject), baseUrl, Accept header, timeouts (60/120), seven pools, fromError;
      no consolidate / fromResponse / toRequest
- [x] 1.2 schema/: `auth.ts` (the two-key credential shape), `common.ts`
      (LinkedIn URL regex, email, company size, checker query),
      `people-search.ts` (filter + paging shapes, exclusion notes),
      `people-enrich.ts`, `contact-info.ts`

## 2. Endpoints (20)

- [x] 2.1 linkedin-enrich ×2: COMPOSITE email/phone/profile_only, the
      either/or counter (D3), `profile_only` honestly optional (D7)
- [x] 2.2 email-enrich ×2: same counter; the work variant's `include`
      verification switch
- [x] 2.3 people-enrich ×2: match credit on every hit + requested contacts;
      per-key `include` vocabulary
- [x] 2.4 contact-info ×2: email/phone lines, `email_type=none` draws no
      email credit (D11)
- [x] 2.5 people-search ×2: `page_size` REQUIRED, reveal lines, object-or-
      array `profiles` counter
- [x] 2.6 decision-makers ×2: fixed page of 25, `anyOf` identifier gate (D6)
- [x] 2.7 domain-enrich, company-search: PER_UNIT·RESULT, object-or-array
      `companies` counter
- [x] 2.8 email-to-linkedin (PER_CALL email_work), email-verify (PER_UNIT
      verifier on definitive verdicts), people-count + three checkers FREE
- [x] 2.9 Every endpoint declares its own inline `inject` naming the key it
      sends — 13 work, 7 personal (D1)
- [x] 2.10 v1 `notes` → `meta.notes`, `hints` → description prose (D13)

## 3. Engine + test runner (D9)

- [x] 3.1 `engine/transport.ts`: `<NAME>_CREDENTIALS` JSON convention ahead
      of `<NAME>_API_KEY`; malformed → MISSING_CREDENTIAL
- [x] 3.2 `engine/auth.ts`: `credentialsEnvVarFor`, hint names both
      variables; exported from `engine/mod.ts`
- [x] 3.3 `engine/deno.json` 0.2.0 → 0.2.1 (contract paths touched; no
      `since` change)
- [x] 3.4 `shared/testing/runner.ts`: replay fakes the doc's required
      credential fields; `liveSkip` opens on either variable
- [x] 3.5 engine.test.ts: both conventions + malformed JSON

## 4. Fixtures + tests

- [x] 4.1 37 synthetic fixtures (`synthetic-` prefix, provenance in each
      description) from v1 test bodies and the public API reference
- [x] 4.2 20 endpoint.test.ts: happy deep-equal usage, miss/empty where the
      vendor has one, 401/404 error-as-data, schema gates, live gated on
      CONTACTOUT_CREDENTIALS; provider-wide tests (two keys, rate literals,
      fn provenance) in linkedin-enrich-work-email
- [ ] 4.3 Obtain a work key + a personal key, set `CONTACTOUT_CREDENTIALS`,
      run `deno task test:live`, then `deno task record` every scenario and
      replace the synthetic fixtures (watch: the `profiles` object-vs-array
      shape, the camelCase `/v1/email/enrich` dialect, whether
      `profile_only=true` as a query string is honoured)
- [ ] 4.4 Confirm with a real personal-key run that the personal pools are
      what `/v1/stats` under that key decrements

## 5. Docs + wiring

- [x] 5.1 openspec: proposal, design D1–D13, spec, tasks
- [x] 5.2 DEVELOPMENT.md Authoring guide: multi-key credentials rule +
      the `<NAME>_CREDENTIALS` convention
- [ ] 5.3 monid-services: Broker provisions `{workApiKey, personalApiKey}`
      for `contactout` (v1 holds `CONTACTOUT_API_KEY_WORK` / `_PERSONAL`)
- [x] 5.4 Verify: fmt · lint · check · test · double-compile ·
      version:check · catalog endpoints (20) · engine:estimate spot checks
