# opoint-connector (delta)

## ADDED Requirements

### Requirement: Opoint provider definition
The opoint provider SHALL declare name `opoint`, `request.baseUrl`
`https://api.opoint.com`, an inline `auth.inject` producing
`Authorization: Token <apiKey>`, timeouts 60 s / 60 s, one credit pool
`default` ("Opoint search calls"), NO `usage.consolidate`, a
provider-level `lifecycle.start` that completes a 2xx whose
`searchresult` reports `response_code ≠ 200` or an `errors` string as
`httpStatus 422` / `providerHttpStatus 200`, a provider-level
`input.toRequest` layering the ARTICLE wire profile under the caller's
`params`, and a provider-level `output.fromResponse` projecting each
article to v1's allow-list (identity, author, time, original URL, site and
readership metadata, topics, ≤256-char snippet; bodies and the tracking
`url` dropped).

#### Scenario: A search consumes one call
- **WHEN** `/search` returns 200 with two documents
- **THEN** usage is `{credits: {default: 1}, evidence: {CALL: 1}}`
- **AND** each output document carries `header`, `orig_url`, `snippet`
  (≤ 256 chars, tags stripped) and no `url`, `body`, or `summary`

#### Scenario: An empty search still consumes the call
- **WHEN** `/search` returns 200 with zero documents
- **THEN** usage is `{credits: {default: 1}, evidence: {CALL: 1}}`

#### Scenario: An in-band failure is a provider error
- **WHEN** `/search` returns HTTP 200 with `searchresult.response_code: 500`
- **THEN** the run completes with `httpStatus 422`, `providerHttpStatus
  200`, `isProviderError true`, and zero usage

### Requirement: Five endpoints, two hosts
The connector SHALL provide `/search`, `/search-advanced`,
`/search-by-ids`, `/search-headlines` (all `POST /search/` on the search
host, PER_CALL 1) and `/suggest` (`GET` on
`https://suggest.api.opoint.com`, FREE, no credential sent). Search
inputs SHALL be strict allow-lists (unknown `params` keys fail
INVALID_INPUT); `/search-by-ids` SHALL size `requestedarticles` to the id
list and set `select_by_ids`; `/suggest` SHALL build its path from
`query`, `types`, and `limit` (default 5).

#### Scenario: Suggest resolves names to filter ids for free
- **WHEN** `/suggest` is run with `{query: "norway", types: ["geo","site"], limit: 3}`
- **THEN** the request is `GET …/single/3/geo%3A0%2Csite%3A0/0/1/nometa/norway`
- **AND** output is `{results: [{type, id, name, url}, …]}` with usage
  `{credits: {}, evidence: {}}`
