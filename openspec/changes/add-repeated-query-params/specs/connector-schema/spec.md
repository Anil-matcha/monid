# connector-schema (delta)

## ADDED Requirements

### Requirement: Wire request parts carry a query MULTIMAP (D3)
`zHttpRequestParts.query` SHALL be a multimap —
`Record<string, string[]>`, at least one value per key, not
`Record<string, string>` — in the shape the `auth.inject` hook receives
AND returns. A single value is
`["v"]`, so no layer branches on `string | string[]`; the type states what
a query string is (`URLSearchParams` models the same multimap). This is a
hook-ABI SHAPE change, so `schema.fn_abi_since` SHALL move with it, while
`schema.doc_format_since` SHALL NOT: no doc field is added or changed.

#### Scenario: An auth fn round-trips a multimap
- **WHEN** `auth.inject` receives `{query: {k: ["a", "b"]}}` and returns it with a header added
- **THEN** the contract validates and both values reach the wire

#### Scenario: A doc gains no new field
- **WHEN** the catalog is compiled after this change
- **THEN** every doc's `minEngineVersion` is `0.1.0` and no doc carries a new key — the shape change is in the hook ABI, not the doc format

### Requirement: Lifecycle http calls accept a scalar or a list (D3)
`zHttpCall.queryParams` SHALL accept `Record<string, string | string[]>`
at the AUTHORING surface — a fn writing `{k: "v"}` SHALL NOT have to wrap
it — and the engine SHALL normalize it through the same serializer the
declarative pipeline uses, so a lifecycle fn cannot spell a list
differently from its own doc. An EMPTY list SHALL be accepted there and
carry the same meaning it does on the declarative path ("no value for
this key": the key is omitted), so a fn building parameters dynamically
needs no length guard. The min-1 floor belongs to the WIRE shape
(`zHttpRequestParts.query`), which is the normalizer's OUTPUT — never to
the authoring input.

#### Scenario: utils.http sends a list as a repeated key
- **WHEN** a lifecycle fn calls `utils.http({method: "GET", path: "/x", queryParams: {id: ["1", "2"]}})`
- **THEN** the issued URL carries `?id=1&id=2`

#### Scenario: utils.http accepts an empty list and omits the key
- **WHEN** a lifecycle fn passes `queryParams: {scalar: "one", ids: ["a", "b"], none: []}`
- **THEN** the call is NOT rejected, and the issued URL is `?scalar=one&ids=a&ids=b` — no `none` parameter
