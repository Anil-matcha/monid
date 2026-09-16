# Design: add-connector-muapi

## D1 — Provider transport and identity

The provider uses `presets.auth.header("x-api-key")` and
`https://api.muapi.ai/api/v1` as its base URL. The endpoint's request path is
already model-specific, so its public identity naturally becomes
`muapi#seedance-2.5-text-to-video`; no transport-only identity pin is needed.

## D2 — Async lifecycle

`lifecycle.start` relays the POST and parks the returned `request_id` as
`externalRunId`. `lifecycle.poll` calls
`GET /predictions/{request_id}/result`. `queued` and `processing` remain
running; `failed`, `cancelled` and `expired` synthesize a 500 with the
provider's 200 recorded; an unknown 2xx state keeps polling. A non-2xx poll
throws so a transient query failure does not abandon a generation that may
still be billable. A completed result must contain a video URL in the
documented `outputs[0]` slot; the catalogued `output.video` shape is accepted
as a compatibility fallback.

## D3 — Input and pricing

The schema mirrors MuAPI's public Seedance 2.5 fields and leaves documented
defaults out of the schema file. The endpoint binding materializes 720p, five
seconds, 16:9 and `high_bitrate: false` before estimate or transport.

The public cost estimator was checked on 2026-09-17. Its current linear card is
$0.17/second at 480p, $0.34/second at 720p, $0.85/second at 1080p and
$1.70/second at 4K. Those are four `PER_UNIT`·`SECOND` lines in a composite
model. Estimate and evidence select one line from the validated request and
count the requested duration. MuAPI's successful `cost.amount_usd` is the
vendor claim and wins at settlement, while any difference is exposed by the
engine's normal derived-usage mismatch signal.

## D4 — Billing envelope

The provider-level `usage.consolidate` plucks the complete `cost` object,
reads `amount_usd`, and returns the rest of the output. Missing cost falls
back to the derived rate-card fold; it is never converted to zero implicitly.
Provider errors never reach usage hooks and therefore settle with empty usage.

## D5 — Test strategy

Fixtures are minimal synthetic chains. The success chain verifies submit,
processing, completion, cost consolidation and URL delivery. Failure fixtures
verify zero-billing for both a terminal task failure and a rejected submit.
Estimate tests use a transport that rejects any request, proving the
pre-run pricing path performs no network I/O.
