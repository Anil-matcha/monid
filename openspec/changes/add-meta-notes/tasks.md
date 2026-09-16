# Tasks: add-meta-notes

## 1. Schema

- [x] 1.1 `zBaseMeta.notes` — `z.array(z.string().min(1)).min(1).optional()`
      (design D3), inherited by provider + endpoint meta

## 2. Compiler

- [x] 2.1 Concatenate provider-then-endpoint notes; omit the key when empty
      (design D1)
- [x] 2.2 Compiler tests: both levels, endpoint-only, provider-only,
      none (no key), empty-entry reject

## 3. Surfacing

- [x] 3.1 No code needed: `catalog inspect` prints the doc itself, so notes
      surface with it (`shared/core/catalog.ts` — "the doc IS the contract").

## 4. Versioning

- [x] 4.1 `ENGINE_VERSION` 0.0.2 → 0.0.3; `schema.doc_format_since` 0.0.1 →
      0.0.3 (design D4 — 0.0.2 was pdl's engine-only bump)
- [x] 4.2 `scripts/version-check.ts`: add `shared/core/schema/meta/*.ts` to
      CONTRACT_PATHS (design D5)
- [x] 4.3 Three tests pinned the floor as the literal "0.0.1"; re-pointed at
      `contractConfig.schema.docFormatSince` so a future bump updates the
      expectation, not the meaning (engine.test.ts ×2, compiler.test.ts ×1)
- [x] 4.4 Verify: fmt · lint · check · test · double-compile · version:check
