# suzanne-connector (delta)

## ADDED Requirements

### Requirement: Suzanne provider with a mixed-mode lifecycle
The suzanne provider SHALL declare name `suzanne`, `request.baseUrl`
`https://api.suzanne3d.com`, auth `presets.auth.bearer()`, timeouts 30 s request
/ 60 s run / 10 s poll, and the credit pool `default` ("US dollars"). It SHALL
declare the ASYNC default as provider-level hooks — `lifecycle.start` (the job
submit) and `lifecycle.poll` (`GET /v1/jobs/{job_id}`) — which the two
generation endpoints inherit and the two synchronous utilities override.

#### Scenario: Submit parks the run
- **WHEN** a generation submit answers `202` with `{job_id: "job_x", status: "queued"}`
- **THEN** the outcome is `RUNNING` with `state.externalRunId` `"job_x"`

#### Scenario: A 2xx without a job id is a contract violation
- **WHEN** a generation submit answers 2xx with no `job_id`
- **THEN** the run SHALL fail EXECUTION_FAILED — never settle as a billed success

#### Scenario: Vendor API errors are data
- **WHEN** a submit answers `409 concurrent_limit_reached`
- **THEN** the run completes with httpStatus 409, `isProviderError` true and
  `{credits: {}, evidence: {}}`

#### Scenario: Polling to completion
- **WHEN** `GET /v1/jobs/{job_id}` reports `queued` or `running`
- **THEN** the outcome is `RUNNING` and the previous state carries forward
- **WHEN** it reports `done`
- **THEN** the outcome is `COMPLETED` httpStatus 200 carrying the job body,
  including `outputs[]` with per-format download URLs

#### Scenario: A failed job is 500-as-data
- **WHEN** the job reports `failed` with `error: {code: "vendor_model_error", message: "…"}`
- **THEN** the outcome is `COMPLETED` with httpStatus 500, providerHttpStatus
  200, the job's own error as output, and zero usage — matching the vendor,
  which refunds those jobs

### Requirement: Four endpoints, flat dollar billing
The connector SHALL provide 4 endpoints: `text-to-3d` and `photo-to-3d`
(ASYNC, `PER_CALL` drawing $0.65), `uploads` (SYNC, `PER_CALL` drawing $0.01,
no input), and `model-download` (SYNC, FREE, public identity pinned
`/v1/models/download`). Every model being flat or FREE, the compiler SHALL
synthesize `usage.estimate` and `usage.evidence`; the connector SHALL author no
quantities fns.

#### Scenario: A generation settles flat
- **WHEN** a text-to-3d run completes with four `outputs[]` entries
- **THEN** usage is `{credits: {default: 0.65}, evidence: {CALL: 1}}` — the
  output count never moves the bill

#### Scenario: The free download never bills
- **WHEN** a model-download run completes
- **THEN** usage is `{credits: {}, evidence: {}}`

### Requirement: The download endpoint projects the 302 Location
`model-download` SHALL override `lifecycle.start` to issue its compiled request
and project a 3xx `location` header into `{download_url}` with httpStatus
normalized to 200 (providerHttpStatus recording the vendor's 302). A 3xx WITHOUT
a readable `location` SHALL surface as a visible provider error, never silent
corruption. Non-3xx responses relay verbatim.

#### Scenario: Presigned URL projection
- **WHEN** `GET /v1/models/job_x/download?format=glb` answers `302` with
  `Location: https://…s3…?X-Amz-Signature=…`
- **THEN** the run completes 200 with `{download_url: "https://…s3…?X-Amz-Signature=…"}`,
  fetchable by the caller with no credential

#### Scenario: Opaque redirect
- **WHEN** a 3xx arrives with no readable `location`
- **THEN** the run completes with the vendor's status and a
  `Redirect missing Location header` message

#### Scenario: Job not finished
- **WHEN** the vendor answers `409 job_not_done`
- **THEN** the body relays verbatim as a provider error with zero usage

### Requirement: Input schemas mirror the current vendor surface
`schema/` SHALL mirror the live vendor surface with optionality only (no
`.default()`): the `faces` menu `200000 | 500000 | 1000000 | 2000000`, `pbr`,
`quad`, `texture_quality` (`standard | detailed`), `outputs` over
`glb | obj | stl | fbx`, and models `sculptor | atelier`. The `images_inline`
channel SHALL be mirrored and then removed at the photo-to-3d binding, which
SHALL also require `images_upload_ids` and be `.strict()`.

#### Scenario: Inline photos are rejected at the boundary
- **WHEN** a photo-to-3d run passes `images_inline`
- **THEN** the run fails INVALID_INPUT before any wire call

#### Scenario: Upload ids are mandatory
- **WHEN** a photo-to-3d run omits `images_upload_ids`
- **THEN** the run fails INVALID_INPUT before any wire call
