# Design: add-repeated-query-params

Decision record for repeated query parameters. Five options were compared
before writing any code; D1 records why the smallest one is also the
correct one.

## D1 — ONE engine rule: an array is a repeated key

The engine learns exactly one list spelling, the HTTP-native one: an array
value is appended once per element (`?k=a&k=b`). Every other spelling —
comma (akta), `k[]=` (PHP/Rails), `k[0]=` (some .NET stacks), a
JSON-encoded parameter — is a VENDOR fact and lives in that connector's
`input.toRequest`, which is already the place a def reshapes input for its
vendor and already holds akta's join:

```ts
// connectors/akta/provider.ts — unchanged by this work
toRequest: ({ data }) => ({
    ...data.input,
    queryParams: Object.fromEntries(
        Object.entries(data.input.queryParams ?? {}).map((
            [key, value],
        ) => [key, Array.isArray(value) ? value.join(",") : value]),
    ),
}),
```

The rejected alternatives, and why:

- **Declare the spelling on the def** (`request.queryArrayFormat:
  "repeat" | "comma"`, resolved endpoint ?? provider, with compile checks
  requiring a declaration wherever a query schema is list-capable). It is
  strictly safer — a forgotten comma-join becomes a compile error instead
  of a wrong URL — at the cost of a doc-format field, an enum over an
  open-ended set, three compile checks and an akta refactor. Not worth it
  while the risk it buys down is already covered: replay matches the
  EXACT url, so akta's fixtures fail loudly the moment its join stops
  happening. If a vendor's spelling ever proves awkward inside a hook,
  this returns with that concrete need.
- **Engine splits comma-separated strings.** Makes a comma a
  metacharacter everywhere: akta's free-text `query` and PDL's locations
  would silently become several parameters, with no error and no opt-out.
- **Do nothing.** The capability is real (PDL multi-value matching raises
  match rates) and the engine's own error string already promised it.

## D2 — The caller-facing type is a LIST, never a comma string

A connector could accept `"A,B"` and split it in `toRequest`. Two reasons
it is the wrong contract, and one that surprises:

1. **It is lossy for this very vendor.** A comma is legal INSIDE a PDL
   value — its own documented example location is `1600 Amphitheatre
   Pkwy, Mountain View, CA 94043`. `split(",")` cannot recover
   `["Mountain View, CA", "New York, NY"]`, and PDL publishes no escaping
   convention: repeating the key IS its answer to that ambiguity.
2. **A list is strictly more expressive.** A connector can always
   `join(",")` for its vendor (akta, one line); it cannot always recover a
   list from a joined string. A list also keeps per-item validation
   (`z.array(z.string().url())`) and tells an agent reading the JSON
   Schema what to send.
3. **It would not avoid this change anyway.** After `toRequest` splits
   `"A,B"`, the resulting array still has to reach the wire as two
   parameters — exactly the edit here. `input.toRequest` returns a
   `RunInput`, not a URL, so a hook alone can never emit a repeated key.

One shape per field stays the rule **for a connector's compiled input
schema** — the surface a caller and an agent read: a `queryParams`
property is a string OR a list of strings, never `anyOf [string, array]`,
so nobody has to decide which of two shapes was meant. pdl's matching
fields are lists; its vendor-single fields are strings.

That rule is scoped deliberately and does NOT reach the AUTHORING
surfaces, which accept both on purpose (D3): `zHttpCall.queryParams` lets
a lifecycle fn write `{k: "v"}` without wrapping it, and `RunInput`
carries whatever a doc's schema declares. The distinction is caller-facing
(one shape, because ambiguity there is a contract defect) versus
fn-facing (two shapes, because the engine normalizes them into one before
anything observes the difference). A later tightening of the connector
rule must not be read as a reason to narrow `zHttpCall`.

## D3 — The wire query is a MULTIMAP

`PreparedRequest.query` and `zHttpRequestParts.query` are
`Record<string, string[]>`: one value is `["v"]`. A query string is a
multimap — `URLSearchParams` models precisely that — so the type now says
what the thing is, and no layer branches on `string | string[]`. The
lifecycle authoring surface (`zHttpCall.queryParams`) still accepts a bare
scalar for convenience and is normalized through the same `toWireQuery`,
so there is exactly one place where a list becomes wire values.

## D4 — An empty list emits nothing

`{k: []}` sends no `k` at all. `?k=` is a PRESENT, empty value to a
vendor — a different request, and one no caller means by "no values".

## D5 — Nesting stays refused

An object, or an array holding anything but scalars, still fails
`INVALID_INPUT`. A query string has no notation for nesting; inventing one
(dotted paths, bracket paths, JSON) would be a vendor-specific guess, and
D1 says those live in the connector.

## D6 — `fn_abi_since` moves; `doc_format_since` does not

Making `query` a multimap is a SHAPE change to the `auth.inject` contract,
not a widening: a fn constructing `query: {k: "v"}` would now be wrong.
Nothing in-tree does — every auth fn spreads `data.request` through and
`presets.auth.header` only touches headers — so no connector moved, but
the stamp should say what happened: `fn_abi_since` → `0.1.0`, engine →
`0.1.0`. Consequence: every doc's `minEngineVersion` becomes `0.1.0` and
the catalog re-hashes. `doc_format_since` stays at `0.0.1`: no doc field
was added or changed.
