# bytedance-connector (delta)

## ADDED Requirements

### Requirement: One endpoint per Seedance model
The connector SHALL expose one endpoint per enabled Seedance model —
`bytedance#seedance-2.0`, `#seedance-2.0-fast`, `#seedance-2.0-mini`,
`#seedance-2.5` — each pinning its own upstream model handle, resolution set,
duration ceiling and rate card. The input SHALL NOT carry a `model` field.

#### Scenario: Public identity is pinned, not derived
- **WHEN** the bundle compiles
- **THEN** each endpoint declares its own `endpoint` path, because all four
  share `request.path` and the derived default would collide

#### Scenario: A model cannot be asked for a capability it lacks
- **WHEN** a caller requests `resolution: "4k"` on `seedance-2.5`
- **THEN** the run is rejected INVALID_INPUT before any upstream call — 2.5's
  enum is 480p/720p

### Requirement: Async Ark task lifecycle
The provider SHALL implement `lifecycle.start` (POST the create-task request)
and `lifecycle.poll` (GET the task), hiding the two-step Ark protocol behind
one run. It SHALL NOT declare `lifecycle.stop` — Ark cancel applies only to
queued tasks.

#### Scenario: Submit parks the run
- **WHEN** the submit returns 2xx with a task id
- **THEN** the run is RUNNING with that id as `externalRunId`

#### Scenario: Submit without a task id is an infrastructure failure
- **WHEN** the submit returns 2xx and no `id`
- **THEN** the fn throws — Ark violated its own contract

#### Scenario: In-flight statuses keep polling
- **WHEN** the task status is `queued` or `running`
- **THEN** the run stays RUNNING and records the status in `state.stage`

#### Scenario: Terminal task failure settles as a provider error
- **WHEN** the task status is `failed`, `cancelled` or `expired`
- **THEN** the run COMPLETES with a synthesized httpStatus 500,
  `providerHttpStatus` 200 (the poll exchange succeeded), and zero usage

#### Scenario: Success without a video is visible, not silent
- **WHEN** the task succeeds but carries no `content.video_url`
- **THEN** the run COMPLETES with a synthesized httpStatus 502 and zero usage

### Requirement: Submit errors are data, poll errors are infrastructure
A non-2xx SUBMIT SHALL settle as data (zero-billed). A non-2xx POLL SHALL
throw as a retriable infrastructure failure, because the upstream task is
likely still running and still billing.

#### Scenario: Ark rejects the submit
- **WHEN** the create-task call returns 4xx
- **THEN** the run COMPLETES with the vendor status and zero usage

#### Scenario: The poll GET fails
- **WHEN** the task GET returns 5xx
- **THEN** the fn throws and the run does not settle

### Requirement: The rate card states both of the vendor's price columns
Each endpoint's `usage.model` SHALL be a COMPOSITE of `PER_UNIT`·`TOKEN` lines,
one per (resolution × reference-video tier), keyed `<resolution>` and
`<resolution>_with_video`, each pinning BytePlus's published $/1M-token rate as
`consumes.amount = rate / 1e6` against the `default` dollar pool with
`every: 1`.

#### Scenario: A plain run bills the no-video column
- **WHEN** a 720p run with no `video_url` content item settles with 108,000
  tokens on `seedance-2.0`
- **THEN** evidence is `{"720p": 108000}` and credits are `{default: 0.756}`

#### Scenario: A reference-video run bills the with-video column
- **WHEN** the same run includes a `video_url` content item
- **THEN** evidence is `{"720p_with_video": 108000}` and credits fold at the
  lower published rate

#### Scenario: Blocking would overcharge
- **WHEN** the fold runs
- **THEN** `every` is 1, so `ceil(tokens/1) × amount` matches the vendor
  exactly rather than rounding up to a token block

### Requirement: Rate keys are read from the request
`usage.estimate` and `usage.evidence` SHALL select the billed line from
`data.input.body` (the requested resolution and whether `content[]` carried a
`video_url`), never from the poll body's echoed `model` or `resolution`.

#### Scenario: A poll body that omits resolution still bills correctly
- **WHEN** the task body carries no `resolution`
- **THEN** the line is still selected, from the request

#### Scenario: An unexpected model echo does not reach billing
- **WHEN** the task body echoes a model id the connector did not submit
- **THEN** the charge is unaffected

### Requirement: Estimates are deduced from the vendor's token formula
`usage.estimate` SHALL compute `width × height × 24 × duration / 1024` using
BytePlus's published dimensions, falling back to 16:9 for `adaptive` or an
absent ratio.

#### Scenario: Auto duration holds the maximum
- **WHEN** `seedance-2.5` is called with `duration: "auto"`
- **THEN** the estimate reserves the model's maximum length (30s), since the
  model — not the caller — picks the length

#### Scenario: Known figure
- **WHEN** 720p 16:9 is requested for 5 seconds
- **THEN** the estimate is 108,000 tokens

### Requirement: The vendor's token meter is stripped from the output
`usage.consolidate` SHALL return an empty `credits` claim (Ark reports no
monetary total, so the derived fold settles) and SHALL remove `$.usage` from
the published output. The quantity remains visible as `usage.evidence`.

#### Scenario: Billing facts do not ride the payload
- **WHEN** a run succeeds
- **THEN** the output carries the task without its `usage` block, and the token
  count appears in `usage.evidence`

### Requirement: Reference URLs are enforced, not merely described
Every `content[]` reference URL SHALL be constrained to a public `https://` URL
by a compiled JSON Schema `pattern`, so the rejection happens before the wire
rather than on the vendor's side. The schema SHALL NOT admit shapes the
connector does not support.

#### Scenario: Unsupported URL forms are rejected locally
- **WHEN** a caller passes an inline `data:` URL, an `asset://` reference, a
  plain `http://` URL, or a malformed string as a reference
- **THEN** the run is rejected INVALID_INPUT before any upstream call

#### Scenario: The constraint reaches the compiled doc
- **WHEN** an endpoint doc is inspected
- **THEN** each of `image_url`, `video_url` and `audio_url` carries the `https`
  pattern — a `.refine()` would have been dropped by `z.toJSONSchema` and
  enforced nothing

### Requirement: Caveats are declared, not buried
Rules that cannot be expressed in the compiled JSON Schema — single
`first_frame`, `last_frame` requiring a `first_frame`, per-role reference caps,
`ratio: "adaptive"` when frames are pinned — SHALL be stated in `meta.notes`,
alongside the operational caveats (result-URL expiry, reference URL forms,
run latency).

#### Scenario: Provider caveats reach every endpoint
- **WHEN** any ByteDance endpoint doc is inspected
- **THEN** it carries the provider's shared caveats followed by its own

#### Scenario: The silently-wrong case is called out
- **WHEN** `seedance-2.5`'s doc is inspected
- **THEN** its notes state that an edit request without explicit edit wording
  generates a NEW video that succeeds and bills in full
