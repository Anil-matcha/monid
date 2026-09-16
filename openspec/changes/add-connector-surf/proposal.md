# Proposal: add-connector-surf

## Why

Surf (asksurf.ai) is a live v1 monid-services provider — 105 endpoints of
crypto intelligence: market and exchange data, derivatives, on-chain and
wallet analytics, projects and VC funds, news, prediction markets (Polymarket
+ Kalshi), Hyperliquid analytics, project signal scores, and a read-only
ClickHouse SQL surface over 111 on-chain tables. It is the largest port so
far, and the simplest billing shape in the catalog: every call draws its
PUBLISHED TIER (Light 1 / Standard 2 / Heavy 4 credits) — a flat PER_CALL
line per doc, no vendor claim, one credit pool. 104 endpoints are synchronous
relays; the durable SQL job (`/onchain/sql/jobs`) is the one async doc.

## What Changes

- **connectors/surf** — 105 endpoints on one host
  (`https://api.asksurf.ai/gateway/v1`; the version segment rides the base
  URL, endpoint paths are the unversioned vendor paths), Bearer auth; 101
  GETs with query parameters, three JSON POSTs and one POST-and-poll job in
  the on-chain SQL family.
  - **The tier is the rate (D1).** One pool `default` = "Surf credits"; each
    doc's PER_CALL line pins its tier. The body's `meta.credits_used` is NOT
    a vendor claim — v1 measured it wrong in both directions — so there is no
    `usage.consolidate`; the derived fold is the bill and the tests hold all
    105 tiers as literals (clay D7a). The field stays in the body, verbatim
    (v1 stripped it), with a provider note saying what it is not.
  - **One provider-level suite, per-endpoint fixtures (D2).** 105 docs of one
    billing shape are tested once, iterating the catalog; every endpoint
    keeps its own recorded-shape fixtures (replay matches on the exact wire
    URL, and `deno task record` writes there). The PR ships as a STACK under
    CodeRabbit's 150-file review limit.
  - **The SQL job lifecycle (D3)** — v1's start / poll / stop ported 1:1 at
    the endpoint (104 of 105 docs are sync): submit → `GET jobs/{id}` until
    `succeeded` → the results read (free) becomes the output; `failed` is a
    synthesized 500, zero-billed; `stop` is a best-effort `DELETE`.
  - **Identifier alternatives (D4)** — v1's `.refine + .meta(anyOf|oneOf)`
    on 13 docs becomes `z.union` of `.required()` arms (compiles to `anyOf`);
    "exactly one" rides `meta.notes`. No binding default inside a union arm.
  - **Bindings (D5)** — 231 vendor defaults moved from v1's mirror to the
    bindings; no row budget is REQUIRED because nothing is estimated.
  - **Categories:** eight new leaves (`token-prices`, `derivatives`,
    `onchain-data`, `defi`, `yields`, `prediction-markets`, `crypto-signals`,
    `web-extraction`), named and described as in the monid-services taxonomy
    manifest.
  - **Mirror verified against the vendor's public OpenAPI** (D12): the live
    document at `api.asksurf.ai/gateway/openapi.json` was diffed field by
    field against the v1 schemas; the differences and what was done are in
    the design.
- **Fixtures are SYNTHETIC** — no Surf key is held in this repo. Envelopes
  follow the v1 design's live-verified upstream contract (`{ data, meta }`,
  `{ error: { code, message } }`), URLs were produced by the engine itself,
  and every file says so.

## Capabilities

- `surf-connector`.

## Non-goals

- Not ported (v1 scope decisions, unchanged — D6): the three job reads by
  caller-supplied id (`GET`/`DELETE jobs/{job_id}`, `GET .../results` — a
  shared-tenant key makes them cross-workspace reads), `project/pulse`
  (deprecated upstream), `x/tweets` (">= 7 credits per unique ID" — a floor
  with no countable evidence). Vendor families added since the v1 port
  (`equity/*` and others, D12) are not in scope.
- No dollar conversion in the doc: the $/credit ($0.006 list, volume tiers to
  $0.002) is the broker card's job.
- No `output.fromResponse` (v1's `credits_used` strip is not carried — D1),
  no `input.toRequest`, no provider-level lifecycle.
- No engine, schema, preset or test-tooling change; `ENGINE_VERSION`
  untouched.

## Impact

New connector tree, eight category leaves, `openspec/changes/add-connector-surf`.
No schema/engine contract change.
