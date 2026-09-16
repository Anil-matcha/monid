# Design: add-meta-notes

Decision record for the `meta.notes` slot.

## D1 — Notes CONCATENATE (provider then endpoint); they do not override

Every other leaf-wise fallback in this repo is "closest wins": `docsUrl` and
`categories` resolve `endpoint ?? provider`, hooks resolve endpoint ?? provider
?? config default. `notes` deliberately does NOT.

A note is an additive FACT about calling the endpoint. A provider-wide note
("the returned URL expires in ~24h") and an endpoint note ("this model needs
`ratio: adaptive` for edits") are both true at once; picking one would drop the
other. v1 had the same shape and the same answer — its endpoint defs spread the
shared list and then the per-model list into one array.

Compiled order is provider-first, then endpoint: general before specific, which
is also the order a reader wants.

The cost is that an endpoint cannot SUPPRESS a provider note. That is accepted:
a provider note that does not hold for one of its endpoints is a mis-placed
note, and the fix is to move it down to the endpoints where it is true.

Alternative rejected: `endpoint ?? provider`, which would force every ByteDance
endpoint to repeat the same five provider caveats verbatim — four copies that
drift independently.

## D2 — `notes` lives on `meta`, not as its own def section

v1's `notes` was a top-level def field. Here it goes on `meta` beside
`summary` and `description`, because that is what it is: display metadata for
catalog and agent consumption, with no runtime behavior. Putting it on
`zBaseMeta` also gets provider + endpoint support for free and keeps the
def's top-level sections meaning "a thing the engine executes or validates"
(`request`, `input`, `output`, `usage`, `auth`, `timeouts`, `lifecycle`).

## D3 — Shape: `z.array(z.string().min(1)).min(1).optional()`

- `.min(1)` on the entries: an empty-string note is a bug, not an empty note.
- `.min(1)` on the array: `notes: []` and an absent `notes` mean the same
  thing, so only one of them is representable. The compiler omits the key when
  the concatenation is empty, which keeps two docs with no notes
  byte-identical (determinism invariant).
- No max length and no max count. A note long enough to need a cap is a
  description; the fix is editorial, not schema.
- Plain strings, no markdown contract. Hosts render one entry as one bullet.

## D4 — This is a doc-format change, so the engine version moves

The compiled doc's `meta` is `zEndpointMeta`, which spreads `zBaseMeta`, and
both are `strictObject`. An engine at 0.0.2 — the currently released one —
handed a doc with `meta.notes` therefore REJECTS it. That is exactly the
condition `doc_format_since` describes, so it moves **0.0.1 → 0.0.3**, and
`ENGINE_VERSION` moves **0.0.2 → 0.0.3** alongside it.

The two numbers start apart because they answer different questions, and 0.0.2
is the case that shows why the split exists: `add-connector-pdl` bumped the
ENGINE (it changed how `usage.credits` RESOLVES) without moving
`doc_format_since`, because the shape of the doc it produces did not change. A
0.0.1 engine can still read a doc compiled by 0.0.2. It cannot read one
carrying `meta.notes` — hence this change moves both.

`schema.spec_version` stays 1.0.0. `doc_format_since` answers "what is the
oldest engine that can read this?" and is the right lever for an additive
optional field; `spec_version` identifies the doc's structural generation and
is reserved for a change that reshapes it.

Consequence, accepted: every doc's `minEngineVersion` becomes 0.0.3, including
docs with no notes. `doc_format_since` is documented as declared-not-computed
precisely so that this stays a single fact instead of a per-doc inference.

## D5 — `version-check` was blind to `meta/base.ts`

`CONTRACT_PATHS` lists `shared/core/schema/endpoint/doc.ts` as the structural
doc format but not the meta objects that doc.ts composes, so this change could
have altered the doc format with the guard reporting "no contract-surface
changes". `shared/core/schema/meta/base.ts`, `meta/endpoint.ts` and
`meta/provider.ts` are added to the list.
