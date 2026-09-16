# Design: add-connector-pdl

Decision record for the pdl port (v1 `adaptors/pdl`, 4 defs). Only the
choices the declarative model forced are recorded.

## D1 — The SDK's wire form, not v1's def shape

v1 declared every def `POST` + JSON body because its default relay only
forwarded a body on non-GET and the `peopledatalabs` SDK did the real
transport. Read off SDK 14.1.1 (`dist/index.modern.js`): enrichment is
`axios.get(…/{person|company}/enrich, {params: URLSearchParams})`, search is
`axios.post(…/{person|company}/search, {query|sql, size, …})`, auth header
`X-Api-Key`. The docs speak that form: enrichment inputs are `queryParams`
(every parameter is a scalar — the engine's scalar-only query rule holds),
search inputs are `body`. Caller-visible consequence: the v1 body-shaped
enrichment input becomes query-shaped. The SDK's `rateLimit` block that v1
stripped was assembled client-side from headers — the raw REST body never
carries it, so nothing is stripped.

## D2 — One credit pool per PDL credit type

PDL's body carries no meter; the response headers do, and hooks cannot
read headers — so there is no vendor claim (no `consolidate`) and the
pools are declarations. PDL meters per credit TYPE: every call's
`x-call-credits-type` header names the type it drew from (docs
usage-limits: `enrich`, `search`, `search_company`, `enrich_company`,
`enrich_skill`, `enrich_job_title`, `preview_search`, `person_identify`)
and the `x-totallimit-remaining` beside it is that type's balance. The
four ported endpoints map 1:1 onto four types. The PROVIDER declares all
four (the account holds all four balances) and each endpoint's
`consumes.credit` names the one it drains, at 1 credit per match / record
— the first multi-pool provider in the catalog. The compiler rule that
blocked exactly this — every declared pool drained by EVERY doc — is
corrected in D6.

Pool ids are OURS, not the vendor's spelling: `<dataset>_<operation>`,
the D28 minted-id rule (line ids are minted from the vendor's native
names by one transform, never copied). PDL's own type strings are
lopsided — the person pools carry no dataset prefix while the company
ones carry a suffix — so the symmetric form reads better at every
billing surface and survives the day PDL adds a third dataset. The join
is a documented mapping, carried in provider.ts:

| pool id          | `x-call-credits-type` |
| ---------------- | --------------------- |
| `people_enrich`  | `enrich`              |
| `people_search`  | `search`              |
| `company_enrich` | `enrich_company`      |
| `company_search` | `search_company`      |

Nothing machine-readable depends on the verbatim string: the broker's
card is keyed by (provider, creditId) — our id — and no hook can read the
header anyway. The mapping matters the day a balance probe or a
header-reading settle exists; it is one table lookup, and tasks 3.3
verifies it against a real call.

First version declared ONE pool
(`default`), reasoning from v1's balance probe — which read a single
`x-totallimit-remaining` off a person-enrich miss and therefore saw the
`enrich` balance only; corrected on PR #7 review (2026-09-16, "There are
more than one type of credits in PDL"). The per-record draw stays pinned
at 1 for every type; a real call's `x-call-credits-spent` confirms it
when a key exists (tasks 3.3).

## D3 — `size` required at the binding, on both variants

D25's standing rule (the primary limiting knob is REQUIRED even when the
vendor publishes a default — PDL's is 1). The mirror is a union of two
strict variants (`query` | `sql`); the binding rebuilds the union with
`size` required on each (`.required({ size: true })` — the akta form; it
keeps the field's describe, which `.unwrap()` would drop from the
compiled doc), so `data.input.body.size` is typed `number` in the
estimate. Vendor bounds 1–100 stay in the mirror.

## D4 — One v1 refinement dies, one survives

The enrichment identifier rule ("one direct identifier, or a name plus a
location-ish field") was a `.superRefine` — unrepresentable in JSON Schema
(D6 of the second wave); documented in the schema `describe`, PDL answers
400 `invalid_request_error`. The search `query` XOR `sql` rule was
`z.union` of two `.strict()` objects — that compiles to `anyOf` of two
`additionalProperties: false` schemas, so a body with both, or neither,
fails validation. Pinned by a test.

## D5 — Synthetic fixtures until a key exists

No `PDL_API_KEY` is held. Fixtures follow the v1 adaptor tests and the PDL
references: person enrichment `{status, likelihood, data}`, company
enrichment flat (record fields beside `status`/`likelihood` — no `data`
wrapper), search `{status, data[], total, scroll_token}`, and the
documented error envelope `{status, error: {type, message}}`. Unverified
against real traffic; replace via `deno task record`.

## D6 — Credit pools: declared per provider, drained per endpoint

PDL is the first vendor metering more than one pool, and it did not fit.
D26 resolved `usage.credits` provider ?? endpoint as a WHOLE MAP and then
required every declared pool to be drained by the doc under compilation —
lawful for a single-pool vendor, impossible for four: a provider-level
set of four failed on all four endpoints (each drains one), so the first
fix pushed the declarations down onto the endpoints. That inverted the
fact being modeled: the pool set belongs to the ACCOUNT, not to any one
call. Three changes, all in the compiler:

1. **Resolution is KEY-WISE, endpoint over provider** — the D20 leaf-wise
   rule the rest of the def already follows (`request.headers` merges the
   same way), reversing D26's deliberate "OPPOSITE of hooks". A provider
   declares the pool SET once; an endpoint adds a pool unique to it or
   restates one, and a provider-level set is never silently shadowed by a
   stray endpoint-level map.
2. **The drain check moves to the DECLARATION SITE.** A pool is dead
   config only where it was declared: a PROVIDER pool must be drained by
   at least ONE of its endpoints (checked once, after the provider's
   endpoints compile — both compile entrypoints load the whole connectors
   tree, so the set is complete); an ENDPOINT pool must be drained by that
   endpoint. Neither check weakens: the undeclared-`consumes.credit` gate
   and the FREE rules are untouched. A consequence worth stating: a
   provider whose endpoints are ALL FREE may declare no pools — nothing
   drains them.
3. **The compiled doc NARROWS to what it drains.** `doc.usage.credits` is
   the resolved declaration filtered to the ids the doc's own lines
   consume. The doc keeps its meaning ("the credit systems the model's
   lines drain"), the engine's FN_CONTRACT check on a consolidate claim
   stays tight (a fn cannot claim a pool the doc has no line for), and
   monid-services prices what it already prices — the run's `credits`
   keys against (provider, creditId). The compiled catalog is unchanged
   byte-for-byte: every existing provider drains its one pool.

No ABI and no doc-format change — the docs' shape, hashes and
`minEngineVersion` all hold (verified: the only catalog diff is
`builtWithEngineVersion`). The engine version moves 0.0.1 → 0.0.2 for one
reason only: `shared/core/schema/sections/usage.ts` documents the
resolution rule and is a `version:check` CONTRACT_PATH, so correcting its
comment obliges the version to differ. `doc_format_since`, `fn_abi_since`
and `async_since` stay at 0.0.1.

## D7 — Vendor grammars the mirror keeps, and the one it cannot

Two PR #7 review findings about input fidelity (D25: the mirror is the
faithful vendor contract, optionality only), landing on opposite sides.

**`dataset` is a STRING, not an enum.** v1 typed person-search `dataset`
as `z.enum(["all", "resume", …])` and the port inherited it. PDL's
parameter is a comma-separated LIST with an exclusion form: `-` entered
once excludes every name after it (`"all,-phone,consumer_social"`), and
the vendor default is `resume`, not `all`. The enum rejected those valid
requests at our own INVALID_INPUT gate, before PDL ever saw them — and
the describe already promised the `-` form, so the schema contradicted
itself. Now `z.string().min(1)` with the names and the grammar in the
describe: documentation that does not gate. The compiled body schema
loses its `enum` for `dataset`; nothing else moves.

**Multi-value parameters stay single.** PDL lets most enrichment
parameters repeat on the query string (`location=A&location=B`, several
`profile`s; `locality`/`region`/`country`/`street_address` may NOT
repeat). The engine's `toScalarQuery` rejects arrays outright —
"array/object encodings arrive at a later engine version" — so the
capability is absent at the transport, not at the schema. Widening the
mirror to string-or-array would compile a doc advertising input the
engine refuses at dispatch: a worse contract than an honest narrow one.
The fields stay single-valued (as v1's did), and repeated-param query
encoding is recorded as what it is — an ENGINE change, with PDL as its
first concrete need (the reserved-surface rule: return with a concrete
need, as its own change).
