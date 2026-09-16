# Proposal: add-repeated-query-params

## Why

A query string has no native notion of a list, so every vendor invents
one. People Data Labs repeats the key — *"append the parameter with values
as many times as needed"* (`?company=A&company=B`) — which is how a caller
widens a match across two possible employers, two social profiles, two
locations. The engine could not send that: `toScalarQuery` refused every
array outright, with a message that promised the capability later
("array/object encodings arrive at a later engine version"). This is that
change; PR #7's review raised it as a concrete need.

The transport was already capable — it calls `url.searchParams.append`,
which is the "add another value under this key" call. Only the type
feeding it (`Record<string, string>`) prevented a second value.

## What Changes

- **The wire query becomes a MULTIMAP** — `Record<string, string[]>` on
  `PreparedRequest` and on `zHttpRequestParts` (the `auth.inject`
  contract). A single value is `["v"]`, so nothing branches on
  `string | string[]`; a query string IS a multimap, which is exactly what
  `URLSearchParams` models.
- **One engine rule: an array is a REPEATED key**, appended in order.
  `toScalarQuery` becomes `toWireQuery`; an empty list emits nothing
  (never a bare `?k=`, which is a present-but-empty value to a vendor);
  objects and nested arrays stay refused, since a query string has no
  nesting to encode them into.
- **Every other spelling stays a VENDOR fact, in `input.toRequest`** —
  where akta's comma join already lives, untouched. The engine does not
  learn comma / `k[]=` / `k[0]=` / JSON-in-a-param, and does not guess.
- `zHttpCall.queryParams` (the lifecycle authoring surface) accepts a
  scalar or a list and is normalized through the same one function, so a
  lifecycle fn and the declarative pipeline spell lists identically.
- `fn_abi_since` moves to `0.1.0` (the query shape change is a hook-ABI
  change) and the engine to `0.1.0`. `doc_format_since` does not move:
  nothing is added to the doc.
- `CONTRACT_PATHS` gains `engine/interfaces/mod.ts`, `engine/transport.ts`
  and `shared/core/schema/common/http.ts` — the wire-request shape lives
  there, and the version gate did not watch any of them.

## Capabilities

- `connector-engine` (MODIFIED — query serialization).
- `connector-schema` (MODIFIED — `zHttpRequestParts`, `zHttpCall`).

## Non-goals

- A declared per-endpoint spelling (`request.queryArrayFormat`) — a doc
  field plus compile checks to encode something `toRequest` already
  expresses, over an open-ended list of spellings. Returns if a vendor's
  spelling proves awkward in a hook.
- Comma-separated strings as the caller-facing type: a comma is legal
  INSIDE a PDL value ("Mountain View, CA"), so splitting one is guesswork
  and the contract would be lossy.
- Bracket / indexed / JSON-encoded query spellings in the engine.

## Impact

`connectors/pdl` gains multi-value enrichment parameters (its own change
entry). Every other connector is untouched in behaviour — akta keeps its
comma join. Every doc's `minEngineVersion` moves to `0.1.0` with
`fn_abi_since`, so the whole catalog re-hashes; no doc field changes.
