# connector-schema (delta)

## ADDED Requirements

### Requirement: Operational notes on provider and endpoint meta
`zBaseMeta` SHALL carry an optional `notes` — a non-empty array of non-empty
strings — inherited by both `zProviderMeta` and `zEndpointMeta`. Each entry is
ONE standalone operational caveat about calling the endpoint (latency, result
expiry, rejected input shapes, silently-wrong parameter combinations), written
to be rendered as a single bullet. `notes` is display metadata only: no hook
reads it and no engine behavior depends on it.

#### Scenario: Provider and endpoint may each declare notes
- **WHEN** a provider def and an endpoint def both declare `meta.notes`
- **THEN** both parse, and the compiled doc carries both (see
  connector-compiler)

#### Scenario: Empty entries are rejected
- **WHEN** a def declares `meta.notes: [""]`
- **THEN** the def fails to parse

#### Scenario: An empty array is not a representable state
- **WHEN** a def declares `meta.notes: []`
- **THEN** the def fails to parse — absent is the only way to say "no notes"

### Requirement: Notes are caveats, not parameter documentation
A constraint about ONE input field SHALL stay on that field's `.describe()`.
`notes` SHALL carry only facts about the call as a whole — including
cross-field rules that `.refine`/`.superRefine` cannot express in the compiled
JSON Schema.

#### Scenario: Cross-field rule has a home
- **WHEN** an endpoint has a rule spanning two input fields that cannot survive
  `z.toJSONSchema`
- **THEN** the rule is stated in `meta.notes`, where an agent reads it before
  calling

## MODIFIED Requirements

### Requirement: Doc format floor tracks the compiled meta shape
`schema.doc_format_since` SHALL move whenever the compiled doc gains, loses or
reshapes a field — including fields contributed by the meta objects that
`zEndpointDoc` composes. `scripts/version-check.ts` `CONTRACT_PATHS` SHALL
include `shared/core/schema/meta/{base,endpoint,provider}.ts`.

#### Scenario: Adding an optional meta field moves the floor
- **WHEN** `zBaseMeta` gains an optional field
- **THEN** `doc_format_since` and `ENGINE_VERSION` both move, because a strict
  older engine would reject a doc carrying it

#### Scenario: The guard sees meta edits
- **WHEN** only `shared/core/schema/meta/base.ts` changes
- **THEN** `deno task version:check` requires an engine version change
