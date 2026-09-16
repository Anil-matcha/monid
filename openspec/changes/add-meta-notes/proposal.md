# Proposal: add-meta-notes

## Why

v1 endpoint defs carry `notes: string[]` — standalone operational caveats an
agent must know BEFORE calling: how long a run takes, that a returned URL
expires, which input shapes the vendor rejects, which parameter combinations
are silently wrong rather than errors. There is no slot for them in v2.

The only place they could go today is `meta.description`, which is the
capability text — "what this does and when to use it". Caveats buried in that
prose are caveats nobody reads, and the two kinds of text have different
lifetimes: a description changes when the endpoint's purpose changes, a note
changes when the vendor's behavior does.

The ByteDance port (add-connector-bytedance) is the forcing case: five
provider-wide caveats plus Seedance 2.5's task-type guidance, where getting the
prompt wording wrong returns a plausible, fully-billed WRONG video with no
error to catch. That belongs in a list an agent reads, not in a paragraph.

## What Changes

- **`shared/core/schema/meta/base.ts`** — `zBaseMeta` gains
  `notes?: string[]` (each entry non-empty; the array non-empty when present).
  Both `zProviderMeta` and `zEndpointMeta` inherit it, so providers and
  endpoints can each declare notes.
- **`shared/compiler/compile.ts`** — compiled `meta.notes` is the
  CONCATENATION `[...provider.meta.notes ?? [], ...def.meta.notes ?? []]`,
  omitted when empty. Deliberately NOT the `endpoint ?? provider` rule used by
  `docsUrl`/`categories`: notes are additive facts, not one overridable value
  (design D1).
- **Surfacing** — no code needed: `catalog inspect` prints the doc itself
  ("the doc IS the endpoint's contract"), so notes surface with it.
- **Doc-format bump** — `ENGINE_VERSION` 0.0.2 → 0.0.3 and
  `schema.doc_format_since` 0.0.1 → 0.0.3, so a doc carrying `meta.notes`
  declares the engine that understands it. (0.0.2 bumped the engine only —
  `add-connector-pdl` changed how `usage.credits` resolves, not the shape of
  the doc it produces.) `shared/core/schema/meta/base.ts` joins
  `CONTRACT_PATHS` in `scripts/version-check.ts` — it was missing, even though
  the doc's `meta` is `zEndpointMeta` spreading this very object.

## Capabilities

- `connector-schema`, `connector-compiler`.

## Non-goals

- No rendering opinion beyond "one entry is one bullet". Hosts decide
  presentation; the contract is only that each entry stands alone.
- Not a replacement for `.describe()` on input fields. A constraint ABOUT ONE
  PARAMETER stays on that parameter; notes are about the call.
- No markdown/structure inside an entry, and no length cap — a note that needs
  a cap is a description in disguise.

## Impact

Additive optional field on the compiled doc. Every doc's `minEngineVersion`
moves to 0.0.3 (the declared floor), which is the intended semantics of
`doc_format_since` — it is a declared historical fact, not a per-doc
computation. No hook ABI change, no fn-table change, no new `Unit`.
