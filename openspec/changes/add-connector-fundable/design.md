# Design: add-connector-fundable

Decision record for the fundable port (v1 `adaptors/fundable`, 17 defs).
Only the choices the declarative model forced are recorded; everything else
mirrors v1 verbatim.

## D1 — `{id}` endpoints get brace-free public identities

`zEndpointPath` (the public identity vocabulary) admits no braces, and the
compiler derives identity from `request.path` when `endpoint` is absent —
so `/deals/{id}` and `/deals/{id}/investors` cannot be their own ids.
Pinned explicitly to `/deal` and `/deal/investors`: the singular form
matches the sibling identifier lookups `/company` / `/investor` / `/person`
(which take their identifier as a query param). Rejected: `/deals/id`
(reads like a literal segment); widening `zEndpointPath` (a contract change,
its own change). The wire path keeps the placeholder; the engine's
`substituteUrl` fills it from `pathParams`. First real use of `pathParams`
in the catalog — pinned by a test asserting the compiled urls and the
substituted replay url.

## D2 — Pool = Fundable credits; `meta.credits_used` is the claim

v1 billed in dollars from the partner price sheet ($0.06/row, $0.06/lookup,
$0.01/search) and kept the credit count only as reconciliation metadata,
because credits do not convert to dollars at one rate (1 credit ⇒ $0.06 on
rows, 0.1 credit ⇒ $0.01 on searches). Owner rule (2026-09-15): pools are
the vendor's OWN credits, never "US dollars". So the model draws credits
(1 / 1 / 0.1 / FREE — the v1 drill's observed `credits_used` per shape),
`usage.consolidate` plucks `meta.credits_used` as the claim (D27: present
claim wins, present 0 prunes, absent omits), and the contract-rate
conversion lives outside the doc. Consequence, eyes open: a broker pricing
fundable from a single $/credit cannot reproduce the partner invoice
exactly — the invoice is by contract rate per endpoint shape.

## D3 — `page_size` required + capped at the binding

D25's standing rule: the primary limiting knob is REQUIRED at the binding
even when the vendor publishes a default (v1: optional, default 10). The
mirror carries the vendor's truth (`max(500)`); the binding derives
`.unwrap().max(100)` — the v1 platform cap (2026-09-01) bounding a
row-billed hold — and the estimate reads the typed `page_size`. The v1
"POST body must be non-empty" refinement becomes moot: a body always
carries `page_size`.

## D4 — v1 refinements documented, not pretended (D6 of the second wave)

`refineExactlyOne` (identifier lookups) and `refineNonEmptyBody` cannot be
represented in the compiled JSON Schema. The identifier rule is now the
schema's `describe` text ("Provide EXACTLY ONE of …"); Fundable answers
400/422 as error-as-data. `zDate` moved from a regex to `z.iso.date()` —
calendar-aware validation that DOES survive compilation.

## D5 — Deep strip of the account fields

v1 stripped `credit_source` / `monthly_credits_remaining` /
`purchased_credits_remaining` from `meta` only, and dropped a `meta` left
empty. v2 uses `utils.json.omit` (deep — the documented same-named-key risk,
D7 of the second wave) and leaves an empty `meta: {}` in place: one less
branch, envelope shape untouched.

## D6 — Synthetic fixtures until a key exists

No `FUNDABLE_API_KEY` is held; fixtures are synthesized from the v1 adaptor
tests and the 2026-09-01 OpenAPI capture, `synthetic-` prefixed, one per
billing shape (row-billed happy/empty/error, flat lookup happy/404,
path-param lookup happy/empty-arrays, 0.1 search on zero results, FREE
resolver). Unverified against real traffic — the second wave's D8 lists
what synthetics have missed before (trailing-slash 307s, envelopes).
Replace via `deno task record` when a key arrives.

## D7 — Compiler fix (port-discovered): `{pathParam}` survives url normalization

The compiler builds each doc's absolute url with `new URL(base + path)
.toString()`, and the URL constructor percent-encodes braces —
`/deals/{id}` compiled to `/deals/%7Bid%7D`, a literal the engine's
`substituteUrl` (which matches `{name}`) can never fill, so every
path-param run would have gone to the wire with the placeholder encoded in
it. No earlier connector had a path param, so nothing caught it. Fix: keep
the normalization (every other compiled url stays byte-identical — the
compat goldens prove it) and restore `%7Bname%7D` → `{name}` after it.
Pinned by a compiler test. Own commit, like D5 of the second wave.
