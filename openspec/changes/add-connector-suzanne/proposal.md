# Proposal: add-connector-suzanne

## Why

Suzanne (api.suzanne3d.com) is a proven v1 monid-services provider — text and
photos into production 3D meshes — and the first port of a provider that MIXES
execution modes: two asynchronous generation endpoints polled to completion, two
synchronous utilities. Apify proved the async protocol for a uniformly async
provider; Suzanne proves the leaf-wise override that a mixed provider needs.

It also surfaces the one capability the engine was missing. Suzanne's model
download answers `302 Found` with the presigned S3 URL in the `Location` header
and an EMPTY body: the payload rides the envelope, not the letter. The engine's
transport already declines to follow redirects (design D16 — credentials must
never travel a redirect), but `TransportResponse` carried `{status, body}` only,
so the URL was discarded before any hook could read it. v1 could read it because
each provider owned its own `fetch`; in v2 all IO flows through the one transport
port, so the port has to carry it.

## What Changes

- **Engine: response headers are data** (`ENGINE_VERSION` 0.1.0 → 0.2.0,
  `async_since` likewise; `fn_abi_since` stays at 0.1.0 — the changed ABI is
  the lifecycle utils' return, so pure-hook docs gain nothing and must not be
  floored at a newer engine). `TransportResponse` gains an optional lowercased
  `headers` map, `HttpResult` (the fn-facing ABI) gains a required one, and
  `directTransport` populates it. Vendor RESPONSE headers only — never our
  request's, so no credential ever becomes fn-visible.
- **Fixtures may carry response headers** — `zRecordedCall.res.headers`,
  restricted to the `RECORDED_RES_HEADERS` allowlist (`location` today). The
  recorder captures only the allowlist and re-attaches it to the response it
  relays; everything else (`set-cookie`, ratelimit, tracing) is dropped, so
  fixtures stay credential-free by construction.
- **connectors/suzanne** — 4 endpoints against `https://api.suzanne3d.com`,
  Bearer auth, a dollars credit pool with v1's contract rates pinned per line:
  - `POST /v1/generations/text-to-3d` — ASYNC, `PER_CALL` $0.65.
  - `POST /v1/generations/photo-to-3d` — ASYNC, `PER_CALL` $0.65, upload-only.
  - `POST /v1/uploads` — SYNC, `PER_CALL` $0.01, no input.
  - `GET /v1/models/{job_id}/download` — SYNC, FREE, identity pinned
    `/v1/models/download`; reads the 302 `location` into `{download_url}`.
  The PROVIDER states the async default (`lifecycle.start` = the job submit,
  `lifecycle.poll` = `GET /v1/jobs/{job_id}`); the two utilities override
  `start` with their own sync fns (D27 subclassing).
- **Schemas mirror the CURRENT vendor surface**, not the v1 adaptor, which had
  drifted: `params.faces` is now the `200000/500000/1000000/2000000` menu
  (default 500000, was 40000/100000/500000/1500000 default 100000), `params`
  gained `quad` and `texture_quality`, `outputs` gained `fbx`, and `atelier`
  now accepts a text prompt as well as a single photo.
- **New category leaf** `3d-generation` (same-PR rule).
- **Synthetic fixtures** (`synthetic-` prefixed, design D11) — provider-level
  shared chains for every shape: generation succeeded / failed / rejected, the
  sync upload, the download 302, an opaque redirect, a 409 `job_not_done`, and a
  401. The key on hand is rejected by the vendor, so nothing could be recorded;
  re-recording is an open task, not a blocker.

## Capabilities

- `connector-engine` (response headers as data)
- `connector-testing` (fixture response headers)
- `suzanne-connector`

## Non-goals

- **`lifecycle.stop`.** `POST /v1/jobs/{job_id}/cancel` now exists (v1 shipped
  before it did), but nothing in the run pipeline needs vendor abort today.
  Return with a concrete need, as its own change.
- **The `capture` model.** A public third model on photo-to-3d requiring all
  four views; v1 called it reserved and this port keeps that.
- **`images_inline`.** The base64 channel is MIRRORED in `schema/inputs.ts`
  (vendor fidelity, design D25) and DISABLED at the endpoint binding: run inputs
  are persisted verbatim into a 400 KB DynamoDB item upstream, and a ≤5 MB photo
  would fail run creation. Callers get a validation issue, not a silent forward.
- **`GET /v1/jobs/{job_id}` and `POST /v1/jobs/{job_id}/cancel` as public
  endpoints.** Both are internal to the lifecycle, exactly as in v1.
- **A drift suite.** Suzanne publishes no machine-readable rate sheet ("pricing
  is set per account"), so pricing cannot be polled. The guard is `test:live`
  plus the D27 per-run `usage.mismatch.derived` signal.
- **No markup in the doc.** v1 carried a user-facing $0.80 `price` beside the
  $0.65 unit price; the doc pins the vendor draw only — the rate card is the
  broker's job.

## Impact

Engine minor bump (contract surface: `HttpResult`, `config.yml`) — every fn
entry's `api` stamp moves to 0.2.0 and the bundle recompiles. Zero source impact
on existing connectors: their fns read `status`/`body`, and the fixture
`headers` field is optional so every committed fixture still parses. New
connector tree, one new category leaf, one README row.
