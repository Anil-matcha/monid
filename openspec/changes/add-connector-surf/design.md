# Design: add-connector-surf

Only the choices the port was FORCED to make. Everything not listed follows
the precedents in `.claude/commands/provider-port.md` (sync GET → akta, sync
POST → exa, the one async doc → suzanne / minimax for endpoint-level
placement).

## D1 — The published tier is the rate; `meta.credits_used` is not a claim

Surf bills every call at a published tier — Light 1 / Standard 2 / Heavy 4
credits — and every 2xx body reports `meta.credits_used`. v1 measured the two
against the account balance (2026-08-03 / 08-04, 13 endpoints, balance
deltas residual-free): the tier table was right thirteen for thirteen; the
field was wrong in BOTH directions (`web/fetch` reports 2, charged 1;
`heatscore/projects` reports 1, charged 4; `onchain/sql` reports 5, which is
not a tier; four operations carry no `meta` at all).

So the field cannot be the vendor claim of design D27: a `usage.consolidate`
lifting it would make the claim WIN at settle and bill the wrong number,
and a claim that disagrees with the fold on most runs is noise, not a
cross-check. Chosen:

- every doc's `usage.model` is a flat `PER_CALL` line at its tier
  (`consumes.amount` = v1's `surfCredits(n)`); one pool `default` = "Surf
  credits" (the $/credit — $0.006 list, volume tiers down to $0.002 — is the
  broker card's job, not the doc's);
- NO `usage.consolidate` anywhere: the derived fold IS the bill. There is
  therefore no `usage.mismatch.derived` to catch a drifted tier at runtime,
  so the tests hold all 105 tiers as LITERALS (clay D7a) and assert the
  table's key set equals the catalog;
- the body is relayed VERBATIM, `meta.credits_used` included. v1 stripped it
  ("publishing a number that is not what the caller was charged would be
  worse than publishing nothing"). Here the doc is the vendor's contract,
  nothing billing-related is READ from the field, and a provider-level
  `meta.notes` entry states on every doc that it is not the charge. The
  strip would have been an `output.fromResponse` that exists only to hide a
  vendor field — the ahrefs D7 posture, applied.

## D2 — One provider-level suite, per-endpoint fixtures, a stacked PR

105 docs with ONE billing shape and no per-endpoint counting logic. A
per-endpoint `endpoint.test.ts` (the sync-provider layout) would be 105
near-identical files asserting the same three facts — the machine-generated
bloat `.coderabbit.yaml` tells the reviewer to flag. The lifecycle-provider
layout (one suite iterating the catalog + shared `fixtures/` bound through
`{{request.url}}`) fits the shape, but its shared chains cannot serve
query-bearing GETs: replay matches on the EXACT wire URL and the binding
substitutes the compiled request URL, which carries no query. Chosen:

- `connectors/surf/provider.test.ts` iterates every doc: the literal tier
  table, the happy replay per endpoint, strictness on all 105, provenance,
  compiled URLs, meta, the SQL job's six chains, one gated live case;
- fixtures stay PER ENDPOINT under `endpoints/<family>/<path>/fixtures/` —
  where `deno task record` writes and where a reader looks — happy on every
  endpoint (the URL match is per-endpoint evidence), empty + unauthorized on
  one representative per family (the flat fold and the error digest are the
  same code path on every doc);
- `test-inputs.json` carries one schema-valid input per endpoint (the
  clay / suzanne convention).

Consequence: ~350 files. CodeRabbit skips a PR over 150 files (the ahrefs
PR, 217 files, was skipped), so the change ships as a STACK of ≤150-file
PRs: the provider, categories, openspec, the suite and the first families,
then the remaining families on top, the tier table and `test-inputs.json`
growing with each. The README's "Adding one" tree keeps its per-endpoint
test line: a provider-level suite is an existing layout (clay, suzanne,
apify), not a new one.

## D3 — The SQL job lifecycle, at the endpoint

`/onchain/sql/jobs` is the one async doc in 105. `resolve()` only falls back
and a provider-level `lifecycle.start` reaches every endpoint (suzanne D3),
so the lifecycle lives ON the doc (minimax's placement), ported 1:1 from
v1's `startSqlJob` / `pollSqlJob` / `stopSqlJob`:

- `start`: the default relay; non-2xx (429 queue capacity, 400 non-SELECT,
  402 balance) is data — no job exists, zero-billed; a 2xx without
  `data.job_id` THROWS non-retriable (v1 EXECUTION_FAILED) — settling it
  would bill 4 credits for nothing; else park with `externalRunId`.
- `poll`: `GET /gateway/v1/onchain/sql/jobs/{id}` (the baseUrl prefix
  written back — `path` resolves against the origin, clay D6). Non-2xx →
  DATA (v1 parity: the job may still finish upstream but can no longer be
  observed, and polls are free — we stop asking, the vendor stops nothing).
  `queued` / `running` → RUNNING. `succeeded` → the results read inside the
  same tick (apify's dataset-fetch), its non-2xx THROWN (an observation
  failure on our side, the run FAILS — v1 parity). `failed` / `canceled` →
  synthesized `httpStatus 500, providerHttpStatus 200` carrying the job's
  own error (D12). No status → throw non-retriable (contract violation, v1
  parity); an UNKNOWN status → keep polling under `runMs` (minimax D7a —
  never fall into the success branch).
- `stop`: best-effort `DELETE`; non-2xx logged.

Two gaps, eyes open, both in tasks.md: (1) a failed job still cost the
4-credit submit upstream; v1 recorded that as an internal `actualCost` on
the error result, and the engine forces zero usage on non-2xx, so the
charge is unrecorded. (2) v1 sent `Idempotency-Key: <runId>:submit` so a
retried start converged on the same job; a hook fn has no run id, so a
host-side retry of the start tick may submit twice (Surf also dedups on
normalized SQL while a retained job exists — upstream behavior, not relied
on).

Timeouts are v1's def overrides: 60 s request / 300 s run / 3 s poll; the
sync `/onchain/sql` keeps its 45 s / 45 s. Submit is HTTP 202 per the live
OpenAPI ("Accepted"); the synthetic chains use it.

## D4 — Identifier alternatives: `.refine + .meta(anyOf|oneOf)` → `z.union`

Thirteen docs accept one of several identifiers (`id` | `q`, `id` | `symbol`,
`condition_id` | `address`, …). v1 enforced it with `.refine` and ADVERTISED
it with `.meta({ anyOf: [{required: [id]}, {required: [q]}] })` — a hand-written
JSON Schema annotation. `.refine` does not survive `z.toJSONSchema`, and the
compiler does not carry `.meta`. Chosen: the binding is
`z.union([zQ.required({ id: true }), zQ.required({ q: true })])`, which
compiles to two `anyOf` arms each with `required` and
`additionalProperties: false` — enforced by ajv before any spend (the clay
person precedent). The rule also rides `meta.notes` in words.

Two consequences:

- `oneOf` ("exactly one" — `onchain/dex/activity`, `heatscore/detail`) is
  not expressible: a union accepts both together, and the vendor answers 400
  (error-as-data, zero-billed). The note says "exactly one".
- ajv's `useDefaults` never enters `anyOf` arms (contactout D7), so a union
  binding carries NO defaults — the vendor's server defaults apply on the
  wire instead of v1's always-serialized ones. Same values, absent rather
  than stated; harmless for a flat PER_CALL doc, where no estimate reads a
  knob.

## D5 — 231 vendor defaults move to the bindings; nothing is REQUIRED

v1 authored `.default()` in its live schemas. The mirror is optionality-only
(D25), so every default moves to the binding as
`zQ.extend({ f: zQ.shape.f.unwrap().default(n) })` — 231 fields across 92
docs, each `n` the vendor's documented default (the v1 descriptions state
"Defaults to n" and the live OpenAPI agrees where it states one). No `limit`
is made REQUIRED: the rule exists for the estimate's basis, and a flat
PER_CALL doc estimates nothing.

## D6 — Scope: v1's five exclusions stand

Surf publishes 124 operations today (D12); v1 integrated 105. Not ported,
for v1's reasons restated in v2 terms:

- `GET` / `DELETE onchain/sql/jobs/{job_id}`, `GET .../results` — job lookup
  is by id alone (unknown id → 404, not 403; probed 2026-08-03) and the
  credential is one Surf tenant per broker, so a caller-supplied id is a
  cross-workspace read (and `DELETE` a cross-workspace cancel). They run
  only inside the job doc's lifecycle, where the id is our own submit's.
- `project/pulse` — `deprecated: true` upstream, superseded by
  `project/ai-news`, which is ported.
- `x/tweets` — priced ">= 7 credits per unique requested ID". PER_UNIT could
  express a per-ID rate, but ">=" is a floor with no rule for the excess and
  no vendor claim to settle on, so no honest `evidence` fn exists. Excluded
  until the vendor publishes the formula.

## D7 — Eight category leaves, from the taxonomy manifest verbatim

The catalog has no crypto leaves. `token-prices`, `derivatives`,
`onchain-data`, `defi`, `yields`, `prediction-markets`, `crypto-signals`
and `web-extraction` are added to `categories.ts` with the display names and
descriptions of monid-services' `registry/taxonomy/manifest.ts`; the five
existing leaves surf also uses (`company-enrichment`, `funding-data`,
`company-news`, `news-search`, `web-search`) are untouched. Endpoint
assignments are v1's (including its known imperfect fits: Kalshi under a
crypto leaf, `market/etf` under `token-prices`).

## D8 — Synthetic fixtures, engine-issued URLs

No Surf key is held. Envelopes follow the v1 design's live-verified upstream
contract (`{ data, meta: { total, limit, offset, credits_used, cached } }`;
errors `{ error: { code, message } }` with no `meta`); rows are placeholders,
and which docs answer an object rather than a list is GUESSED from the v1
summaries (`detail`, `net-worth`, `fetch`, …) — nothing billing-related
depends on it. Each fixture's URL (and POST body) was produced by running the
doc through the engine with a stub fetch, so binding defaults, the
`{condition_id}` substitution and the encoding are recorded exactly as
issued. Every file is `synthetic-` prefixed and says so; live tests are
written and gated on `SURF_API_KEY`.

## D9 — `{condition_id}` docs: brace-free ids, a `pathParams` slot

`polymarket/price-ohlcv/{condition_id}` and `volume-split/{condition_id}`
keep the placeholder on the wire path (the engine substitutes and
URI-encodes from `input.pathParams` — v1's `httpProviderRuntime` did the
same) and pin `endpoint:` to the brace-free path (the id regex admits no
placeholders — fundable's `/deal` precedent).

## D10 — Timeouts

Provider 60 s / 60 s from `endpointExecution/config.yml` (surf); the two
SQL-family overrides from their v1 defs (D3). No `pollMs` at provider level:
only the job doc polls.

## D11 — Folder names: the wire path, slashes as dashes

The loader requires endpoint folder names unique across group directories
("leaf names are the identity"), and five bare leaves collide across surf's
families (`candles`, `detail`, `price`, `ranking`, `transfers`). Rather than
disambiguate five folders by hand, every folder is the wire path with
slashes as dashes under its family (`market/market-price`,
`prediction-market/prediction-market-polymarket-markets`) — mechanical,
unique by construction, and the suite derives a fixture path from an id
without a table.

## D12 — The mirror against the live OpenAPI

`https://api.asksurf.ai/gateway/openapi.json` (version 0.2.97, fetched
2026-09-16) was diffed field by field against the v1 schemas: names,
required, enums, defaults, bounds. All 105 v1 paths are present. Differences
and what was done:

| Field | v1 | live | v2 |
|---|---|---|---|
| `search/fundraising` `lang` | enum en/zh/ja/kr | + `ko` (alias for kr) | enum extended |
| `exchange/markets` `exchange` | free string, no default | enum of 17 venues, default `binance` | enum + binding default |
| `onchain/sql`, `sql/preflight`, `sql/jobs` `max_rows` | no default ("Defaults to 1000 (server-side)") | default 1000 | binding default 1000 |
| `onchain/query` `limit` 1–10000, `offset` ≥ 0 | bounded | unbounded | v1 bounds kept (the vendor's own summary caps rows at 10000) |
| `onchain/query` `fields` / `filters` / `sort` | optional array | array or `null` | optional array (omission covers it; `null` is not a value a caller needs) |
| `hyperliquid/performance` `dex`; `hyperliquid/trades` `dex`, `direction`, `symbol` | absent | listed, described "NOT SUPPORTED — returns 400 if set" | absent: `.strict()` rejects them before the wire, which beats the vendor's paid-for 400 |
| POST bodies `$schema` | absent | a framework artifact | absent |

Operations in the live document that v1 never integrated: the five of D6,
thirteen `equity/*` operations and `portfolio/wallets` — a new vendor family,
a scope decision for the owner (tasks.md 4.3), not this port.
