# Proposal: add-connector-muapi

## Why

MuAPI provides a unified API over current video-generation models, making it
useful to Monid agents that want one credential and one async protocol while
choosing among model families. It is a natural provider addition beside the
existing direct model connectors, and its response envelope reports the
vendor's actual generation charge so Monid can cross-check its estimate.

## What Changes

- Add `connectors/muapi` with `x-api-key` auth, the `api.muapi.ai/api/v1`
  base URL, and a shared submit/poll lifecycle.
- Add the first model-specific endpoint,
  `muapi#seedance-2.5-text-to-video`, covering prompt, resolution, duration,
  aspect ratio, seed, and high-bitrate controls.
- Declare the current public per-second USD card for 480p, 720p, 1080p and
  4K. The provider consolidator lifts MuAPI's actual `cost.amount_usd`
  claim from successful result envelopes and removes the billing field from
  user output.
- Add synthetic success, task-failure and rejected-submit fixtures and replay
  tests. No live generation is needed to validate the connector.

## Non-goals

- Do not add every MuAPI model in this change; each model family needs its own
  reviewed schema, capability notes and rate card.
- Do not make generation requests during tests or CI.
- Do not add a live pricing-drift service; the vendor claim is retained as the
  per-run source of truth and the pinned card is the estimate cross-check.

## Impact

New connector files only. The existing video-generation category and lifecycle
contract are reused; no engine, schema, compiler or version bump is required.
