# ploid-connector (delta)

## ADDED Requirements

### Requirement: Ploid provider definition
The ploid provider SHALL declare name `ploid`, `request.baseUrl`
`https://api.ploid.com`, auth `presets.auth.bearer()`, timeouts
60 s / 60 s, one credit pool `default` ("Ploid ACU"), and a provider-level
`usage.consolidate` that claims `meta.credits_charged` or `meta.acu_used`
(whichever the response carries), strips `request_id`, `session_id` and
the ACU balance fields from `meta`, drops an emptied `meta`, and keeps
`meta.warning` / `meta.cursor`.

#### Scenario: Search bills per started block of 10
- **WHEN** `POST /v1/search` with `num_results: 7` returns 7 results and
  `meta.credits_charged: 0.1`
- **THEN** usage is `{credits: {default: 0.1}, evidence: {RESULT: 7}}`
- **AND** `meta.warning` survives in the output while `credits_charged`
  and `request_id` do not

#### Scenario: Enrich bills found-only components
- **WHEN** `POST /v1/enrich` resolves profile and email and returns
  `phone: null` with `meta.acu_used: 2`
- **THEN** usage is `{credits: {default: 2}, evidence: {profile: 1, email: 1, phone: 0}}`

### Requirement: The agent is the one async doc
`POST /v1/agent` SHALL declare endpoint-level `lifecycle.start` and
`lifecycle.poll` with `timeouts.pollMs` 5000 and `runMs` 600000; a 2xx
with `data.status` queued/running SHALL park RUNNING with
`externalRunId = data.run_id`; the poll SHALL GET the stashed
`data.poll_url`; a 2xx body with a top-level `error` SHALL complete with
providerHttpStatus 200 and `httpStatus` = `error.http_status` when that is
an integer in 400–599, else 502; the
completed body's `meta.acu_used` SHALL settle as CREDIT units.

#### Scenario: A queued run completes with one ACU used
- **WHEN** the start answers 202 queued, one poll answers running, the
  next answers the completed body with `meta.acu_used: 1`
- **THEN** the run completes 200 with usage
  `{credits: {default: 1}, evidence: {CREDIT: 1}}` and no `session_id`
  in the output

### Requirement: Ten endpoints, one pool
The connector SHALL provide `v1/search`, `v1/socials`, `v1/enrich`,
`v1/agent`, `v1/linkedin/profile`, `v1/linkedin/search`,
`v1/linkedin/posts`, `v1/linkedin/profiles/comments`,
`v1/linkedin/companies/get`, `v1/linkedin/companies/posts`; every
billable doc SHALL drain `default` in ACU; `num_results` and `limit` on
the two searches SHALL be required; the agent SHALL reject `session_id`
and `max_spend_usd` as unknown fields.
