# connector-engine (delta)

## ADDED Requirements

### Requirement: Query serialization — a list is a REPEATED key (D1/D3)
The engine SHALL serialize `input.queryParams` into a MULTIMAP —
`PreparedRequest.query: Record<string, string[]>`, where a single value is
a one-element list — and the transport SHALL `append` once per value, in
the caller's order, so a multi-element list reaches the wire as a REPEATED
parameter (`?k=a&k=b`). That is the ONLY list spelling the engine knows;
it SHALL NOT join, bracket, index or JSON-encode a list, and SHALL NOT
infer a spelling from the values. A vendor that spells lists another way
(akta: comma-joined) does so in its own `input.toRequest`, before the
values reach the serializer — a joined list therefore arrives as ONE
value and is sent as one parameter. An EMPTY list SHALL emit nothing (a
bare `?k=` is a present, empty value to a vendor — a different request).
An object, or an array holding anything but scalars, SHALL fail
`INVALID_INPUT`: a query string has no nesting to encode. `utils.http` and
`utils.request` SHALL normalize through the same function, so a lifecycle
fn and the declarative pipeline spell lists identically.

#### Scenario: A list is repeated, in order
- **WHEN** a run passes `queryParams: {q: "hi", extra: ["b", "a", "b"]}`
- **THEN** the issued URL is `?q=hi&extra=b&extra=a&extra=b` — order and duplicates preserved

#### Scenario: One value, two spellings, one wire
- **WHEN** a run passes `extra: "only"` and another passes `extra: ["only"]`
- **THEN** both issue the identical URL — a single value IS a one-element list

#### Scenario: An empty list sends nothing
- **WHEN** a run passes `extra: []`
- **THEN** the issued URL carries no `extra` parameter at all — never `?extra=`

#### Scenario: A connector-joined list stays one value
- **WHEN** a provider's `input.toRequest` joins `["a","b"]` into `"a,b"` for its vendor
- **THEN** the issued URL carries ONE `extra=a%2Cb` parameter — the engine never re-splits it

#### Scenario: Nesting is refused
- **WHEN** a run passes `extra: [["nested"]]` or `extra: [{deep: 1}]`
- **THEN** the run fails `INVALID_INPUT` naming the offending index
