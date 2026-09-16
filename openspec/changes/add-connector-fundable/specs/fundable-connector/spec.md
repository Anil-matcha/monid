# fundable-connector (delta)

## ADDED Requirements

### Requirement: Fundable provider definition with shared settle fns
The fundable provider SHALL declare name `fundable`, `request.baseUrl`
`https://www.tryfundable.ai/api/v1` (path prefix preserved), auth
`presets.auth.bearer()`, timeouts 60 s request / 60 s run, credit pool
`default` ("Fundable credits"), a provider-level `usage.consolidate` that
plucks `meta.credits_used` as the vendor claim and deep-strips
`credit_source`, `monthly_credits_remaining`, `purchased_credits_remaining`,
and a provider-level `usage.evidence` that counts the one collection array
under `data` for PER_UNIT docs and nothing for flat/FREE docs.

#### Scenario: Claim wins and agrees
- **WHEN** `POST /deals` with `page_size: 3` returns 3 rows and
  `meta.credits_used: 3`
- **THEN** usage is `{credits: {default: 3}, evidence: {RESULT: 3}}` with
  no `mismatch`, and the output's `meta` keeps only pagination keys

#### Scenario: Zero rows bill nothing
- **WHEN** a row-billed run returns `data.deals: []` and `credits_used: 0`
- **THEN** usage is `{credits: {}, evidence: {RESULT: 0}}`

### Requirement: Seventeen endpoints, four billing shapes
The connector SHALL provide 17 sync endpoints: 7 PER_UNIT·RESULT at 1
credit/row with `page_size` REQUIRED (max 100) and `estimate = page_size`;
5 PER_CALL at 1 credit; 3 PER_CALL at 0.1 credit; 2 FREE. Public identities
SHALL equal the native paths except `/deals/{id}` → `/deal` and
`/deals/{id}/investors` → `/deal/investors`.

#### Scenario: Path param substitution
- **WHEN** `fundable#deal/investors` runs with `pathParams.id` a UUID
- **THEN** the wire url is `…/api/v1/deals/<uuid>/investors` and an empty
  lineup still bills the flat 1 credit

#### Scenario: page_size gate
- **WHEN** a row-billed run omits `page_size` or passes 101
- **THEN** the run fails INVALID_INPUT before any wire call
