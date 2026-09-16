# contactout-connector (delta)

## ADDED Requirements

### Requirement: ContactOut provider definition with two keys and seven credit pools
The contactout provider SHALL declare name `contactout`, `request.baseUrl`
`https://api.contactout.com`, `request.headers` `{Accept:
application/json}`, timeouts 60 s request / 120 s run, the credential
shape `{workApiKey, personalApiKey}` (both required) with NO provider
inject — every endpoint declares its own inline inject placing one of the
two keys in the `token` header — the seven credit pools `email_work`, `phone_work`, `search_work`,
`email_personal`, `phone_personal`, `search_personal`, `verifier`, and a
provider-level `output.fromError`. It SHALL declare no `usage.consolidate`,
no `output.fromResponse`, no `input.toRequest` and no lifecycle.

#### Scenario: Every doc carries the one two-key credential
- **WHEN** the bundle is compiled
- **THEN** all twenty docs SHALL carry a credentials schema requiring
  `["workApiKey", "personalApiKey"]`
- **AND** the seven personal-key docs (`v1/linkedin/enrich/personal-email`,
  `v1/email/enrich/personal-email`, `v1/people/enrich/personal-email`,
  `v1/people/linkedin/personal-email`, `v1/people/search/personal-email`,
  `v1/people/decision-makers/personal-email`,
  `v1/people/linkedin/personal_email_status`) SHALL inject
  `personalApiKey` and the other thirteen `workApiKey`

#### Scenario: Two injects, interned
- **WHEN** the bundle is compiled
- **THEN** all thirteen work docs SHALL share one `auth.inject` fn key and
  all seven personal docs another, distinct one

#### Scenario: Each doc narrows to the pools it drains
- **WHEN** the bundle is compiled
- **THEN** `contactout#v1/linkedin/enrich/work-email` SHALL carry credits
  `email_work`, `phone_work`, `search_work`; `…/personal-email` the three
  `_personal` pools; `contactout#v1/email/verify` only `verifier`;
  `contactout#v1/people/person` only `email_work`; and the four FREE docs
  none

### Requirement: Twenty endpoints, every billable line one vendor credit
The connector SHALL expose exactly twenty endpoints: six work/personal
pairs on shared wire paths (`/v1/linkedin/enrich`, `/v1/email/enrich`,
`/v1/people/enrich`, `/v1/people/linkedin`, `/v1/people/search`,
`/v1/people/decision-makers`, ids suffixed `/work-email` and
`/personal-email`) and eight singles (`/v1/domain/enrich`,
`/v1/company/search`, `/v1/people/count`, `/v1/people/person`,
`/v1/people/linkedin/personal_email_status`, `…/work_email_status`,
`…/phone_status`, `/v1/email/verify`). Every billable line SHALL consume
`amount: 1` of a pool suffixed by the doc's key kind, except the verifier
line. `/v1/people/count` and the three checkers SHALL be FREE.

#### Scenario: Enrich hit draws email and phone, no search credit
- **WHEN** `GET /v1/linkedin/enrich` under the work key returns a profile
  with a work email and a phone
- **THEN** usage SHALL be `{credits: {email_work: 1, phone_work: 1},
  evidence: {email_found: 1, phone_found: 1, profile_only: 0}}`

#### Scenario: Enrich without contacts draws exactly one search credit
- **WHEN** the profile returns with every contact array empty
  (`profile_only=true`, nothing on file, or only the other email kind)
- **THEN** usage SHALL be `{credits: {search_work: 1}, evidence:
  {email_found: 0, phone_found: 0, profile_only: 1}}`

#### Scenario: Misses are free in both shapes
- **WHEN** `/v1/linkedin/enrich` answers 200 with `profile: []`
- **THEN** usage SHALL be `{credits: {}, evidence: {email_found: 0,
  phone_found: 0, profile_only: 0}}`
- **AND WHEN** `/v1/email/enrich`, `/v1/people/enrich`, `/v1/people/person`
  or `/v1/people/linkedin` answers 404
- **THEN** the run SHALL complete as a provider error with usage
  `{credits: {}, evidence: {}}`

#### Scenario: The camelCase scalar dialect counts
- **WHEN** `/v1/email/enrich` returns `profile.email` as a string and
  `profile.phone` as a string
- **THEN** evidence SHALL count `email_found: 1, phone_found: 1`

#### Scenario: People-enrich bills every match
- **WHEN** `/v1/people/enrich` under the personal key returns a profile
  with a personal email and no phone
- **THEN** usage SHALL be `{credits: {search_personal: 1, email_personal:
  1}, evidence: {profile_matched: 1, email_found: 1, phone_found: 0}}`

#### Scenario: Contacts-only phone-only lookup draws no email credit
- **WHEN** `/v1/people/linkedin` is called with `email_type=none` and
  `include_phone=true` and returns a phone
- **THEN** usage SHALL be `{credits: {phone_work: 1}, evidence:
  {email_found: 0, phone_found: 1}}`

#### Scenario: Search bills per profile returned, reveals per profile with data
- **WHEN** `/v1/people/search` with `page_size: 2, reveal_info: true`
  returns two profiles keyed by URL, one carrying an email and a phone
- **THEN** usage SHALL be `{credits: {search_work: 2, email_work: 1,
  phone_work: 1}, evidence: {profiles: 2, email_reveals: 1,
  phone_reveals: 1}}`
- **AND WHEN** `profiles` is an array instead of an object
- **THEN** the count SHALL be the same

#### Scenario: Companies count in either shape
- **WHEN** `/v1/domain/enrich` returns `companies` as an object keyed by
  domain with two entries
- **THEN** usage SHALL be `{credits: {search_work: 2}, evidence: {RESULT: 2}}`
- **AND WHEN** `/v1/company/search` returns `companies` as a one-element
  array
- **THEN** usage SHALL be `{credits: {search_work: 1}, evidence: {RESULT: 1}}`

#### Scenario: Verifier bills only definitive verdicts
- **WHEN** `/v1/email/verify` returns `data.status` of `valid`, `invalid`
  or `accept_all`
- **THEN** usage SHALL be `{credits: {verifier: 1}, evidence: {RESULT: 1}}`
- **AND WHEN** it returns `unknown` or `disposable`
- **THEN** usage SHALL be `{credits: {}, evidence: {RESULT: 0}}`

### Requirement: Estimates are deduced from the request
`usage.estimate` SHALL promise, for `/v1/linkedin/enrich`, `{profile_only:
1}` when `profile_only === true` and `{email_found: 1, phone_found: 1}`
otherwise; for `/v1/people/search`, `page_size` on `profiles` and on both
reveal lines when `reveal_info === true`; for `/v1/people/decision-makers`
and `/v1/company/search`, the vendor's fixed page of 25; for
`/v1/domain/enrich`, `domains.length`; for `/v1/people/linkedin`, the
email line unless `email_type === "none"` and the phone line when
`include_phone === true`; for `/v1/people/enrich`, the match line plus each
contact line named in `include`.

#### Scenario: Search hold follows page_size and reveal
- **WHEN** `/v1/people/search/work-email` is estimated with `{page_size: 3,
  reveal_info: true}`
- **THEN** the estimate SHALL be `{credits: {search_work: 3, email_work: 3,
  phone_work: 3}, evidence: {profiles: 3, email_reveals: 3,
  phone_reveals: 3}}`

### Requirement: Input gates
Every input schema SHALL be `.strict()`. `/v1/people/search` SHALL require
`page_size` (1–25) at the binding. `/v1/people/decision-makers` SHALL
compile its query to a three-arm `anyOf` requiring one of `linkedin_url`,
`domain`, `name`. Each key variant SHALL accept only its own kind in
`include` / `data_types` / `email_type`. LinkedIn profile URLs SHALL match
`linkedin.com/(in|pub)/`, company URLs `linkedin.com/company/`, and email
fields `format: email`.

#### Scenario: The other key's vocabulary is rejected before the wire
- **WHEN** `/v1/people/enrich/work-email` is called with `include:
  ["personal_email"]`, or `/v1/people/linkedin/work-email` with
  `email_type: "personal"`
- **THEN** the run SHALL fail with INVALID_INPUT and no request SHALL be
  issued

#### Scenario: Decision makers need an identifier
- **WHEN** `/v1/people/decision-makers` is called with `{}` or `{page: 1}`
- **THEN** the run SHALL fail with INVALID_INPUT

### Requirement: Local credential resolution for multi-key providers
The engine's default params resolver SHALL read `<NAME>_CREDENTIALS` as a
JSON object of string values ahead of `<NAME>_API_KEY`, SHALL reject a
malformed value with MISSING_CREDENTIAL, and SHALL keep mapping
`<NAME>_API_KEY` to `{apiKey}`. Replay tests SHALL fake every field the
doc's compiled credentials schema requires.

#### Scenario: Two keys from one variable
- **WHEN** `CONTACTOUT_CREDENTIALS` is `{"workApiKey":"w","personalApiKey":"p"}`
- **THEN** the resolver SHALL return that object and every contactout doc
  SHALL pass credential validation
