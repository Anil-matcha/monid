# pdl-connector (delta)

## ADDED Requirements

### Requirement: PDL provider definition
The pdl provider SHALL declare name `pdl`, `request.baseUrl`
`https://api.peopledatalabs.com`, auth `presets.auth.header("X-Api-Key")`,
timeouts 60 s / 60 s, a provider-level `usage.credits` declaring ALL FOUR
pools the account meters (`people_enrich`, `people_search`,
`company_enrich`, `company_search` — our `<dataset>_<operation>` ids,
mapped in provider.ts onto PDL's `x-call-credits-type` values `enrich`,
`search`, `enrich_company`, `search_company`), NO
`usage.consolidate` (the vendor meter lives only in
response headers), and a provider-level `usage.evidence` that counts
`data[]` for PER_UNIT docs and nothing for flat docs.

#### Scenario: Search bills per record from the derived fold
- **WHEN** `POST /v5/person/search` with `size: 3` returns 3 records
- **THEN** usage is `{credits: {people_search: 3}, evidence: {RESULT: 3}}`

#### Scenario: Enrichment bills one credit per match
- **WHEN** `GET /v5/company/enrich?website=stripe.com` returns 200
- **THEN** usage is `{credits: {company_enrich: 1}, evidence: {CALL: 1}}`
- **AND** a 404 no-match is a provider error with zero usage

### Requirement: Four endpoints, one pool each
The connector SHALL provide `GET /v5/person/enrich`, `POST
/v5/person/search`, `GET /v5/company/enrich`, `POST /v5/company/search`;
each doc's model SHALL drain the one provider-declared pool matching its
PDL credit type (person
enrich → `people_enrich`, person search → `people_search`, company
enrich → `company_enrich`, company search → `company_search`) at 1 credit per
record or match; search `size` SHALL be required (1–100); a search body
carrying both `query` and `sql`, or neither, SHALL fail INVALID_INPUT.

#### Scenario: Each endpoint drains its own PDL credit type
- **WHEN** the catalog is compiled
- **THEN** `pdl#v5/person/enrich` carries credits `{people_enrich}`, `v5/person/search` `{people_search}`, `v5/company/enrich` `{company_enrich}`, `v5/company/search` `{company_search}` — each doc narrowed to the one pool its model consumes

#### Scenario: Search size is required and bounded
- **WHEN** `POST /v5/person/search` is called with a body carrying `query` but no `size`
- **THEN** the run fails INVALID_INPUT — `size` is the estimate's whole basis, so the caller states it (1–100)
