# connector-compiler (delta)

## ADDED Requirements

### Requirement: Notes concatenate provider-first, never override
The compiler SHALL resolve `meta.notes` as
`[...provider.meta.notes ?? [], ...def.meta.notes ?? []]` — the ONE additive
resolution in the doc, deliberately unlike `docsUrl`/`categories`, which
resolve `endpoint ?? provider`. A provider note and an endpoint note are both
true at once; ordering is general-before-specific.

#### Scenario: Both levels contribute
- **WHEN** a provider declares 2 notes and its endpoint declares 1
- **THEN** the compiled doc's `meta.notes` has 3 entries, the provider's two
  first, in declaration order

#### Scenario: Endpoint-only notes
- **WHEN** only the endpoint declares notes
- **THEN** the compiled doc carries exactly the endpoint's notes

#### Scenario: Provider notes reach every endpoint
- **WHEN** only the provider declares notes
- **THEN** every endpoint doc under it carries them

### Requirement: Absent notes leave no key
The compiler SHALL OMIT `meta.notes` from the compiled doc when the
concatenation is empty, so two docs with no notes serialize identically
(determinism invariant).

#### Scenario: No notes anywhere
- **WHEN** neither the provider nor the endpoint declares notes
- **THEN** the compiled doc has no `notes` key and its hash is unchanged from
  before this capability existed

### Requirement: Notes are visible in the catalog
`deno task catalog inspect <id>` SHALL render the resolved notes.

#### Scenario: Inspect shows caveats
- **WHEN** a doc carries notes
- **THEN** `inspect` prints them as a labelled list
