# Tasks: add-connector-suzanne

## 1. Engine — response headers are data

- [x] 1.1 `HttpResult.headers` (contract) + `TransportResponse.headers?`
- [x] 1.2 `directTransport` populates them; `fn-utils` threads them to fns
- [x] 1.3 `ENGINE_VERSION` 0.1.0 → 0.2.0 and `config.yml` `async_since`
      likewise — the changed ABI is the LIFECYCLE utils' return, so the bump
      lands on `async_since`, not `fn_abi_since`: a pure-hook doc gained no
      capability and must not be floored at a newer engine
- [x] 1.4 Engine tests: a 302 `location` reaches the fn; the redirect is not
      followed; keys are lowercased; a transport omitting them yields `{}`

## 2. Testing — fixture response headers

- [x] 2.1 `zRecordedCall.res.headers` + `RECORDED_RES_HEADERS` allowlist
- [x] 2.2 `replayFetch` serves them; `recordingFetch` captures the allowlist AND
      re-attaches it to the relayed response; `trimCalls`/`scrubCalls` carry it
- [x] 2.3 Tests: allowlist drops `set-cookie`/ratelimit; record→relay round trip;
      replay serves them; absent ⇒ none

## 3. Provider

- [x] 3.1 `categories.ts`: `3d-generation` leaf
- [x] 3.2 `provider.ts`: bearer auth, baseUrl, timeouts, dollars pool,
      `lifecycle.start` (strict submit) + `lifecycle.poll` (job status),
      `output.fromError` over BOTH error shapes (nested API envelope +
      flat job error), `request_id` carried
- [x] 3.3 `schema/common.ts`: models, params (faces menu / pbr / quad /
      texture_quality), outputs, format, upload id, job id — current surface

## 4. Endpoints (4)

- [x] 4.1 `text-to-3d` — async inherited, PER_CALL $0.65
- [x] 4.2 `photo-to-3d` — async inherited, PER_CALL $0.65, inline disabled at
      the binding (mirrored in the schema)
- [x] 4.3 `uploads` — sync `start` override, PER_CALL $0.01, no input
- [x] 4.4 `model-download` — sync `start` override reading the 302 `location`,
      FREE, identity pinned `/v1/models/download`

## 5. Recording + fixtures

- [x] 5.1 Synthetic provider-level shared chains for all seven shapes, with
      `{{request.url}}` / `{{request.origin}}` bindings + `test-inputs.json`
- [ ] 5.2 **BLOCKED — the key on hand is rejected (403; see design D11).** With
      a working key: `deno task record` the real chains, then run `test:live`.
- [ ] 5.3 **Depends on 5.2.** Inspect a TERMINAL job row for
      `billable_amount_cents`; if present, add the provider `usage.consolidate`
      (cents → dollars, entry omitted when absent) so the pinned rates become a
      live per-run cross-check. If absent, record that the fold IS the bill.

## 6. Tests

- [x] 6.1 `lifecycle.test.ts`: both generations over the shared chains, failed
      job, rejected start, the no-job_id contract violation, provenance (shared
      provider fns; two distinct sync overrides; no stop; compiled download url
      keeps `{job_id}`; the rate card and pool pruning)
- [x] 6.2 Per-endpoint: uploads sync shape; download 302 projection, opaque
      redirect guard, 409 relay; photo-to-3d input gates (inline rejected,
      upload ids mandatory)
- [x] 6.3 Live suite written and gated on `SUZANNE_API_KEY` (uploads happy +
      a FREE 404 download probe that costs nothing) — unrun, see 5.2

## 7. Wiring + docs

- [x] 7.1 README connector row
- [x] 7.2 Verify: fmt · lint · check · test (207 passed) · double-compile
      byte-identical · catalog smoke · estimate smoke
- [ ] 7.3 `test:live` — see 5.2
