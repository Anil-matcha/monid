# Proposal: add-connector-bytedance

## Why

ByteDance (BytePlus ModelArk / "Ark") is a live v1 monid-services provider: four
Seedance video-generation models behind one credential, one async task API, and
a published per-token rate card. It is the first GENERATIVE connector in this
repo — everything shipped so far reads existing data; this one creates a new
artifact and bills for the compute that made it.

That difference is what makes it worth porting now. It exercises three parts of
the contract nothing else does:

- a **metered model whose rate depends on the request**, not just the response
  (BytePlus prices per resolution AND per whether the input carried a reference
  video) — the first real test of D19's "selection is a counting rule, never a
  model shape";
- a **long async run** (tens of seconds to 30 minutes) with no vendor-reported
  credit total, so the derived fold is the only settlement path;
- the **first non-Apify lifecycle provider**, which tells us whether the async
  hook family generalizes or was shaped around one vendor.

## What Changes

- **connectors/bytedance** — 4 endpoints, one per Seedance model
  (`seedance-2.0`, `-fast`, `-mini`, `seedance-2.5`), all async, all sharing the
  provider's Bearer auth, timeouts, Ark task lifecycle (`start` submit →
  `poll` task), `output.fromError` envelope unwrap, dollar credit pool and
  `usage.consolidate` token strip.
- **The rate card is the vendor's, both columns.** BytePlus publishes two
  $/1M-token rates per resolution — input WITHOUT a reference video and input
  WITH one. v1 always charged the higher column and kept the spread as margin;
  here the doc states what BytePlus actually charges and markup stays a
  downstream broker-card concern (design D2). Each endpoint is a `COMPOSITE` of
  `PER_UNIT`·`TOKEN` lines keyed `<resolution>` / `<resolution>_with_video`.
- **Estimates are deduced from the vendor's own formula**
  (`width × height × 24fps × seconds / 1024`), with the dimension table inlined
  in each fn (closed terms cannot import). `duration: "auto"` holds the model's
  maximum length (design D5).
- **New category leaf** `video-generation` — the closed vocabulary has nothing
  AI-generation-shaped.
- **Recorded fixtures** from live Ark runs for the success and rejection chains;
  the two failure shapes that cannot be provoked on demand stay synthetic.

## Capabilities

- `bytedance-connector`.

## Non-goals

- **No `lifecycle.stop`.** Ark's cancel applies only to `queued` tasks; v1
  declares `stoppable: false`. Advertising a capability we cannot honor is
  worse than omitting it.
- **No Seedream (image) or voice family.** v1 names them as future ModelArk
  families; neither has endpoints, IDs or published rates today.
- **No `seed` / `camera_fixed` / `frames` / `draft` / `service_tier` inputs** —
  undocumented or unsupported for these models, exactly as in v1.
- **No drift suite.** BytePlus publishes no machine-readable pricing or schema
  surface; coverage is `test:live` plus the per-run `usage.mismatch` signal
  (`scripts/drift/contract.ts` states this policy).
- **No CROSS-field input validation.** See design D6 — rules spanning two or
  more fields have nothing to compile to in JSON Schema, so they move to
  `meta.notes`. Single-field constraints (enums, ranges, `additionalProperties`,
  and the reference-URL `pattern`) stay in the schema and ARE enforced before
  the wire.

## Impact

New connector tree + one category leaf. Connector-only: no engine bump, no new
`Unit`, no new preset, no hook-ABI change. Depends on `add-meta-notes` for the
`meta.notes` slot the caveats live in.
