# Tasks: add-connector-surf

## 1. Provider + categories

- [x] 1.1 provider.ts: bearer auth, `/gateway/v1` baseUrl, timeouts 60/60,
      one pool (`default` = Surf credits), fromError over
      `{ error: { code, message } }`, provider notes (tier billing,
      `meta.credits_used` is not the charge, no cache, rate limit); no
      consolidate (D1)
- [x] 1.2 categories.ts: `token-prices`, `derivatives`, `onchain-data`,
      `defi`, `yields`, `prediction-markets`, `crypto-signals`,
      `web-extraction` (manifest names + descriptions verbatim)

## 2. Endpoints (105)

- [x] 2.1 104 synchronous relays: faithful mirror per endpoint
      (`schema/inputs.ts`, describe inside optional), vendor defaults at the
      binding (D5), flat PER_CALL at the published tier, v1 meta (summary ↔
      description swapped into their v2 roles)
- [x] 2.2 13 identifier-alternative docs: `z.union` of `.required()` arms +
      the rule in `meta.notes` (D4)
- [x] 2.3 `/onchain/sql/jobs`: start / poll / stop lifecycle, 60/300/3 s
      (D3); `/onchain/sql` 45/45 s
- [x] 2.4 The two `{condition_id}` docs: brace-free ids, `pathParams` slot
      (D9)
- [x] 2.5 Folder layout `endpoints/<family>/<wire path, slashes as dashes>/`
      (D11)
- [x] 2.6 Mirror diffed against the live OpenAPI (D12)

## 3. Fixtures + tests

- [x] 3.1 Synthetic fixtures, URLs issued by the engine with a stub fetch
      (D8): happy per endpoint (104), empty + unauthorized per family
      representative (14 × 2), six SQL-job chains
- [x] 3.2 `provider.test.ts`: the literal 105-row tier table (key set ==
      catalog), every relay's happy replay, family empties and 401s, strict
      gate on all 105, enum / pattern / uri / union gates, provenance
      (one auth, one fromError, no consolidate, synthesized quantities, one
      lifecycle, timeouts), compiled URLs, meta notes, the six job chains,
      live gated on `SURF_API_KEY`
- [ ] 3.3 Obtain a Surf key: `deno task test:live`, then `deno task record`
      for a representative per family and the SQL job (each run draws its
      tier) and replace the synthetic fixtures — confirm the `data` shapes
      (array vs object) the synthetic bodies guessed, the job's submit HTTP
      status (202 assumed) and status vocabulary
- [ ] 3.4 With the key, spot-check the tier table by balance differencing
      on the endpoints v1 read off the "(partial)" table rather than
      measured (v1 tasks 7.x)

## 4. Follow-ups

- [ ] 4.1 A failed SQL job costs 4 credits upstream that the run cannot
      record (the engine zero-bills non-2xx) — D3; revisit if the engine
      grows a "cost on error" channel
- [ ] 4.2 The submit has no Idempotency-Key (hook fns have no run id) —
      a host-side retry of the start tick may double-submit; v1 keyed it on
      the pipeline run id (D3)
- [ ] 4.3 Vendor families added since the v1 port (`equity/*`, others —
      D12) are a scope decision for the owner, not this change

## 5. Docs + verify

- [x] 5.1 openspec: proposal, design D1–D12, spec, tasks
- [x] 5.2 Verify: fmt · lint · check · test · double-compile ·
      version:check · catalog endpoints (105)
- [ ] 5.3 Ship as a stack of ≤150-file PRs (D2); update the tier table and
      `test-inputs.json` in each
