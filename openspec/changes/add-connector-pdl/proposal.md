# Proposal: add-connector-pdl

## Why

People Data Labs is a live v1 monid-services provider with four
synchronous endpoints — person and company enrichment and search. v1 spoke
to PDL through the vendor's JavaScript SDK; the SDK is a thin axios wrapper,
so the port speaks its wire form directly (GET enrichment with query-string
parameters, POST search with a JSON body). The port needs no new engine
capability.

## What Changes

- **connectors/pdl** — 4 endpoints, `X-Api-Key` auth, 60 s timeouts:
  - `GET /v5/person/enrich`, `GET /v5/company/enrich`: PER_CALL, one
    credit per match (a 404 no-match is error-as-data: a provider error
    carrying the vendor envelope, zero usage — never an exception).
  - `POST /v5/person/search`, `POST /v5/company/search`: PER_UNIT·RESULT,
    one credit per record in `data[]`; `size` REQUIRED at the binding
    (vendor bounds 1–100), estimate = `size`; `query` XOR `sql` as two
    strict variants.
- **Four credit pools**, one per PDL credit type (design D2):
  `people_enrich`, `people_search`, `company_enrich`, `company_search` —
  our symmetric ids (D28 minted-id rule), mapped in provider.ts onto the
  vendor's `x-call-credits-type` values (`enrich`, `search`,
  `enrich_company`, `search_company`) and declared once on the PROVIDER
  (the account holds all four balances); each endpoint drains its own at
  1 credit per record or match.
- **The compiler's credit rule, corrected** (design D6): `usage.credits`
  resolves KEY-WISE endpoint over provider, a declared pool must be
  drained at its declaration site (a PROVIDER pool by at least ONE
  endpoint, an ENDPOINT pool by that endpoint), and the compiled doc
  narrows to the pools its own lines drain. The old rule — every declared
  pool drained by EVERY doc — made a multi-pool provider undeclarable.
- **No `usage.consolidate`**: PDL reports its meter only in response
  headers, which hooks cannot read; the derived fold settles.
- Synthetic fixtures (`synthetic-` prefix) — no `PDL_API_KEY` is held.

## Capabilities

- `pdl-connector`.
- `connector-schema` (MODIFIED — the credits declaration/drain rule, D6).

## Non-goals

- The SDK's other surfaces (bulk enrichment, retrieve, autocomplete,
  identify, cleaner, job title, IP, changelog) — never in v1's catalog.
- The v1 balance probe (`x-totallimit-remaining` header) — a hosted
  concern, and headers are not visible to hooks.
- The v1 `dataset: "all"` default on person search: PDL documents its own
  default, and no estimate reads the knob, so it stays plain optional.

## Impact

New connector tree + README row, plus one compiler rule (design D6:
credits resolve key-wise, drain per declaration site, doc narrows to what
it drains). No hook-ABI and no doc-format change — the compiled catalog is
byte-identical apart from `builtWithEngineVersion`; the engine moves
0.0.1 → 0.0.2 solely because the corrected comment in
`shared/core/schema/sections/usage.ts` sits on a `version:check`
CONTRACT_PATH.
