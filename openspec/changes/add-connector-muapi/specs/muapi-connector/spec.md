# muapi-connector (delta)

## ADDED Requirements

### Requirement: MuAPI provider lifecycle and billing

The MuAPI provider SHALL use `x-api-key` auth against
`https://api.muapi.ai/api/v1`, declare the `video-generation` category and
one `default` credit pool labelled `US dollars`. Its lifecycle SHALL submit a
request, poll `/predictions/{request_id}/result`, keep `queued` and
`processing` requests running, and settle terminal task failures as
zero-usage provider errors. A completed result SHALL contain a video URL. The
provider SHALL lift `cost.amount_usd` from successful result envelopes and
remove the `cost` object from the user-facing output.

#### Scenario: completed generation settles the vendor claim

- **WHEN** the submit returns `request_id`, the poll returns `processing`, and
  the next poll returns `status: "completed"`, `outputs[0]` and
  `cost.amount_usd: 1.7`
- **THEN** the run completes with HTTP 200, the video URL remains available,
  the cost object is absent from output, and usage credits are 1.7 USD.

#### Scenario: failed task is free

- **WHEN** a poll returns `status: "failed"`
- **THEN** the run completes as a synthesized HTTP 500 with provider status
  200 and empty credits/evidence.

### Requirement: Seedance 2.5 text-to-video endpoint

The connector SHALL provide `muapi#seedance-2.5-text-to-video` with a required
prompt and optional resolution (`480p`, `720p`, `1080p`, `4k`), duration (4-30
seconds), aspect ratio, seed and high-bitrate fields. The binding SHALL
materialize MuAPI's documented defaults of 720p, 5 seconds, 16:9 and false.
Its usage model SHALL price requested seconds at $0.17, $0.34, $0.85 and $1.70
for the four resolutions respectively, selecting the line from the request.

#### Scenario: default estimate

- **WHEN** the caller supplies only a prompt
- **THEN** the estimate is five `720p_second` units and 1.70 USD.

#### Scenario: 4K estimate

- **WHEN** the caller supplies a prompt, `resolution: "4k"` and `duration: 30`
- **THEN** the estimate is thirty `4k_second` units and 51.00 USD.
