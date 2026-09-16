# Proposal: add-connector-fundable

## Why

Fundable (tryfundable.ai) is a proven v1 monid-services provider — 17 live
endpoints of real-time startup funding data (rounds, funded companies,
investors, people, and the two free permalink resolvers) — with a fully
uniform shape: one synchronous JSON call each, Bearer auth, a
`{success, data, meta}` envelope, and the vendor's own credit meter on every
response. It is the first port under the provider-port skill and the first
connector to use `{pathParam}` placeholders; nothing about it needs a new
engine capability.

## What Changes

- **connectors/fundable** — 17 endpoints, all sync, all inheriting the
  provider's Bearer auth, timeouts, credit pool, vendor-meter
  `usage.consolidate` (plucks `meta.credits_used`, strips the account-level
  `credit_source` / `*_remaining` fields), and generic `usage.evidence`
  (counts the one collection array under `data`).
  - 7 row-billed (`POST /deals` `/companies` `/investors` `/people`,
    `GET /company/deals` `/investor/deals` `/person/deals`): PER_UNIT·RESULT
    at 1 credit/row, `page_size` REQUIRED and capped at 100 at the binding,
    estimate = `page_size`.
  - 5 flat lookups (`GET /deals/{id}`, `/deals/{id}/investors`, `/company`,
    `/investor`, `/person`): PER_CALL at 1 credit.
  - 3 fuzzy resolvers (`GET /company/search` `/investor/search`
    `/person/search`): PER_CALL at 0.1 credit (charged on zero results).
  - 2 permalink resolvers (`GET /industry/search` `/location/search`): FREE.
- Public identities: every doc's id is its native path except the two
  `{id}` endpoints, pinned to `/deal` and `/deal/investors` (design D1).
- Synthetic fixtures (`synthetic-` prefix) for 5 representative endpoints
  covering all four billing shapes and all three input channels; no
  `FUNDABLE_API_KEY` is held, so nothing is recorded.

- **Compiler fix** (port-discovered, design D7): `{pathParam}` placeholders
  in compiled urls were percent-encoded by url normalization and could never
  be substituted; restored after normalization, pinned by a test.

## Capabilities

- `fundable-connector`.

## Non-goals

- v1 excluded `GET /person/email` (not on the partner price sheet;
  account-wide unlock ownership), `GET /alerts` and
  `GET /alerts/configurations` (account-scoped resources) — not ported.
- No new category leaves: `funding-data`, `company-enrichment`,
  `people-enrichment` already exist.
- No dollar conversion in the doc: the partner invoices from a contract
  price sheet ($0.06/row and lookup, $0.01/search) that is NOT a single
  $/credit rate; pools are the vendor's credits (owner rule 2026-09-15) and
  the conversion stays the broker card's job.

## Impact

New connector tree + README row; no schema/engine contract changes
(`ENGINE_VERSION` unchanged, no new `Unit`, no new preset).
