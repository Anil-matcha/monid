# Proposal: add-connector-ploid

## Why

Ploid is a live v1 monid-services provider (partnership, prod-included):
people intelligence — plain-English people search, social and
LinkedIn-anchored enrichment, six public LinkedIn reads, and a model-led
research agent. Ten synchronous-or-async JSON endpoints on one host with
one `{data, meta}` envelope and one native billing unit (ACU). The port
needs no new engine capability: nine docs are declarative, `/v1/agent`
uses the existing lifecycle hooks.

## What Changes

- **connectors/ploid** — 10 endpoints, `Authorization: Bearer`, 60 s
  timeouts (`/v1/agent`: run 600 s, poll 5 s):
  - `POST /v1/search`, `POST /v1/linkedin/search`: PER_UNIT·RESULT,
    `every: 10`, 0.1 ACU per started block; `num_results` / `limit`
    REQUIRED at the binding; evidence counts `data.results[]` /
    `data.items[]`.
  - `POST /v1/socials`: PER_CALL 1 ACU (a 404 miss is data, zero usage).
  - `POST /v1/enrich`: COMPOSITE of three found-only lines (profile 1,
    email 1, phone 10 ACU), counted 0/1 from the raw body's non-null
    fields; `enrichments` carries the vendor default `["profile"]`.
  - `POST /v1/agent`: async — endpoint-level `lifecycle.start/poll/state`
    (202 → RUNNING on `data.run_id`; `GET data.poll_url`; a 2xx `error`
    envelope completes under its own `http_status`, fallback 502);
    PER_UNIT·CREDIT 1 ACU per ACU of `meta.acu_used`; the caller sets the
    vendor's `max_acu` (1–64, default 2); `operation` / `memory` /
    `sources` pinned in `toRequest`, `session_id` never accepted.
  - Five flat LinkedIn reads (`profile`, `posts`, `profiles/comments`,
    `companies/get`, `companies/posts`): PER_CALL 0.06 ACU.
- **One credit pool** `default` ("Ploid ACU", design D2) with ONE provider
  consolidate reading `meta.credits_charged` or `meta.acu_used` and
  stripping v1's `META_INTERNAL_KEYS` (incl. the shared-workspace
  `session_id`); an emptied `meta` is dropped; `warning` / `cursor` stay.
- **connectors/categories.ts** — new leaf `agents`.
- Fixtures: every endpoint's 401 is RECORDED (invalid key — real error
  envelope + every wire body); successes are `synthetic-`.

## Capabilities

- `ploid-connector`.

## Non-goals

- v1's three readability renames (`/linkedin/company`,
  `/linkedin/company-posts`, `/linkedin/comments`): v2 identity is the
  vendor path (pdl / akta precedent), so the docs are
  `ploid#v1/linkedin/companies/get` etc.
- The v1 balance probe (`GET /v1/account/credits`) — a hosted concern.
- The vendor surface v1 already excluded (agent connect/connections,
  session memory, the stage-lookalike contract, account usage / key
  delete, People Sets preview) — cross-tenant workspace state or account
  internals.
- The authored USD 0.01 user price on the LinkedIn reads — hosted pricing.

## Impact

New connector tree + one category leaf + README row; no schema/engine
contract changes.
