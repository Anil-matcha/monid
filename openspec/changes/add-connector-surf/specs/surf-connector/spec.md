# surf-connector (delta)

## ADDED Requirements

### Requirement: Surf provider definition with one credit pool and no vendor claim
The surf provider SHALL declare name `surf`, `request.baseUrl`
`https://api.asksurf.ai/gateway/v1`, auth `presets.auth.bearer()`, timeouts
60 s request / 60 s run, the single credit pool `default` ("Surf credits"),
a provider-level `output.fromError` digesting `{ error: { code, message } }`,
and provider `meta.notes` stating that `meta.credits_used` is not the amount
charged. It SHALL declare no `usage.consolidate`, no `output.fromResponse`,
no `input.toRequest` and no lifecycle.

#### Scenario: Every doc inherits the provider's hooks
- **WHEN** the bundle is compiled
- **THEN** all 105 surf docs SHALL share one `auth.inject` fn key and one
  `output.fromError` fn key, SHALL have no `usage.consolidate`, and SHALL
  carry the provider's `meta.credits_used` note

### Requirement: One hundred and five endpoints billing the published tier
The connector SHALL expose exactly 105 endpoints whose ids are the v1
catalog paths (the two `{condition_id}` docs pinned brace-free). Every
`usage.model` SHALL be `PER_CALL` with `consumes.amount` equal to the
endpoint's published tier (1, 2 or 4 Surf credits; 25 / 35 / 45 docs), and
`usage.estimate` / `usage.evidence` SHALL be the compiler-synthesized empty
fns.

#### Scenario: A 2xx settles the tier regardless of result size
- **WHEN** `GET /market/price` returns `{ data: [...], meta: { credits_used: 1 } }`
- **THEN** usage SHALL be `{credits: {default: 2}, evidence: {CALL: 1}}` and
  the output SHALL still carry `meta.credits_used`

#### Scenario: An empty result still draws the tier
- **WHEN** a relay returns `{ data: [], meta: {...} }`
- **THEN** usage SHALL be `{credits: {default: <tier>}, evidence: {CALL: 1}}`

#### Scenario: Errors are data
- **WHEN** upstream answers 401 `{ error: { code: "UNAUTHORIZED", message } }`
- **THEN** the run SHALL complete as a provider error with usage
  `{credits: {}, evidence: {}}` and output `{message, code, raw}`

### Requirement: The durable SQL job is polled inside its doc
`POST /onchain/sql/jobs` SHALL own a `lifecycle.start` / `poll` / `stop`: a
2xx submit without `data.job_id` SHALL throw (non-retriable); `queued` /
`running` SHALL keep the run RUNNING; `succeeded` SHALL read
`GET /onchain/sql/jobs/{id}/results` in the same tick and complete with that
body; `failed` / `canceled` SHALL complete with a synthesized 500 carrying the
job's own error; a non-2xx poll SHALL complete as data; an unknown status
SHALL keep polling; `stop` SHALL `DELETE /onchain/sql/jobs/{id}` best-effort.
Timeouts SHALL be 60 s request / 300 s run / 3 s poll.

#### Scenario: Submit, poll, results
- **WHEN** the submit answers `{ data: { job_id } }`, a poll answers
  `succeeded` and the results read answers 200
- **THEN** usage SHALL be `{credits: {default: 4}, evidence: {CALL: 1}}` and
  the output SHALL be the results body

#### Scenario: A failed job is zero-billed
- **WHEN** a poll answers `{ data: { status: "failed", error } }`
- **THEN** the run SHALL complete with httpStatus 500, providerHttpStatus
  200, usage `{credits: {}, evidence: {}}`, and the digested error SHALL
  carry the job's message and code

### Requirement: Identifier alternatives survive compilation
Where v1 required at least one of several identifiers (`.meta({ anyOf })`)
or exactly one (`.meta({ oneOf })`), the binding SHALL be a `z.union` of the
mirror with each identifier `.required()`, compiling to `anyOf` arms that
each carry `required` and `additionalProperties: false`; no arm SHALL carry
a `default`; the exclusivity rule SHALL ride `meta.notes`.

#### Scenario: Neither identifier is rejected before the wire
- **WHEN** `/fund/detail` is called with neither `id` nor `q`
- **THEN** the run SHALL fail with INVALID_INPUT and no request SHALL be
  issued
- **AND WHEN** it is called with `q` alone or `id` alone
- **THEN** the input SHALL validate

### Requirement: Input gates
Every schema SHALL be `.strict()`. Vendor defaults SHALL be applied at the
binding (`default` in the compiled schema) except inside union arms. Enums,
numeric bounds, the `agent.<table>` pattern on `/onchain/query` `source` and
the `uri` format on `/web/fetch` `url` SHALL be enforced before any spend.

#### Scenario: An unknown key never reaches the wire
- **WHEN** any surf endpoint is called with one key outside its schema
- **THEN** the run SHALL fail with INVALID_INPUT
