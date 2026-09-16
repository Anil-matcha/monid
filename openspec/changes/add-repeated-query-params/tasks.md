# Tasks: add-repeated-query-params

## 1. Engine

- [x] 1.1 `shared/core/schema/common/http.ts`: `zHttpRequestParts.query`
      becomes a multimap (`Record<string, string[]>`, min 1 per key)
- [x] 1.2 `engine/interfaces/mod.ts`: `PreparedRequest.query` likewise
- [x] 1.3 `engine/request.ts`: `toScalarQuery` → `toWireQuery` — scalar ⇒
      one-list, array ⇒ list, empty ⇒ omitted, nesting refused
- [x] 1.4 `engine/transport.ts`: append once per value, order preserved
- [x] 1.5 `shared/core/schema/hooks/lifecycle.ts` + `engine/fn-utils.ts`:
      `zHttpCall.queryParams` takes a scalar or a list, normalized through
      `toWireQuery` (utils.http no longer spreads raw)

## 2. Tests

- [x] 2.1 list ⇒ repeated key, order + duplicates preserved
- [x] 2.2 one-element list ≡ bare scalar (same URL)
- [x] 2.3 empty list emits nothing — never `?k=`
- [x] 2.4 a list joined in `toRequest` stays ONE value (the akta spelling)
- [x] 2.5 nesting still fails INVALID_INPUT
- [x] 2.6 lifecycle `utils.http` spells lists identically — repeated key,
      and an EMPTY list omits the key rather than tripping FN_CONTRACT
      (PR #17 review)
- [x] 2.7 the three ABI-floor assertions move to 0.1.0 (engine × 2,
      compiler golden)

## 3. Versioning + guard

- [x] 3.1 engine `0.0.2` → `0.1.0`; `config.yml` `fn_abi_since` → `0.1.0`
      (shape change, not a widening); `doc_format_since` unchanged
- [x] 3.2 `scripts/version-check.ts`: add `engine/interfaces/mod.ts`,
      `engine/transport.ts`, `shared/core/schema/common/http.ts` to
      CONTRACT_PATHS — the wire-request shape lives there and the gate was
      not watching it

## 4. Verify

- [x] 4.1 check · lint · test · double-compile · version:check
- [x] 4.2 compiled diff vs main: pdl's 2 enrichment docs change content;
      every other doc moves `minEngineVersion` only; akta's fixtures pass
      unchanged
