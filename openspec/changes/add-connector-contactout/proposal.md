# Proposal: add-connector-contactout

## Why

ContactOut (contactout.com) is a live v1 monid-services provider — twenty
synchronous JSON endpoints of LinkedIn-native contact data: profile
enrichment, contacts-only reveal, flexible person enrichment, people and
company search, decision makers, email-to-LinkedIn, three free availability
checkers, and email verification. It is the first connector whose vendor
issues TWO API keys — a work-email account and a personal-email account,
each with its own credit pools and its own email rate — so it is also the
first to declare `auth.credentials` at the endpoint. Everything else it
needs already exists: key-wise credit pools (pdl), counting rules for
either/or billing (D19), literal-rate tests where the vendor reports no
meter (clay D7a).

## What Changes

- **connectors/contactout** — 20 endpoints, all sync, on one host with a
  bare `token` header.
  - **Two keys, one credential, per-endpoint inject (design D1).** The
    provider declares the credential shape `{workApiKey, personalApiKey}`
    (both required, v1 parity) and no inject; every endpoint declares its
    own inline inject naming the key it sends — thirteen the work key,
    seven the personal key. The six email-bearing operations ship as work/personal PAIRS on
    one wire path, ids suffixed `/work-email` and `/personal-email` (the v1
    ids, verbatim).
  - **Seven credit pools in vendor credits (D2)** — email / phone / search
    per key, plus the shared verifier pool — declared once on the provider;
    every line draws `amount: 1`. No `usage.consolidate`: ContactOut
    responses carry no meter, so the derived fold is the bill and the tests
    hold the rates as literals.
  - **Counting rules (D3, D4):** one email / phone credit per profile with
    that contact; the search credit per profile returned, or per matched
    profile WITHOUT billable contacts (the vendor's either/or on
    `/v1/linkedin/enrich`); misses (200 `profile: []`, or 404) are free.
  - **Schemas:** the people-search filter vocabulary, the people-enrich
    identifiers and the contacts-only query are shared fragments under
    `schema/`; each variant spells its own key-kind vocabulary
    (`include`, `data_types`, `email_type`). Cross-field v1 refinements ride
    `meta.notes`; decision-makers' "at least one identifier" binds as a
    compiled `anyOf` (D6).
- **Engine 0.2.0 → 0.2.1 (D9):** the local credential resolver learns a
  second env convention, `<NAME>_CREDENTIALS` — a JSON object in the doc's
  own credential shape — ahead of `<NAME>_API_KEY`. No hook ABI, doc
  format or lifecycle change; `fn_abi_since` / `doc_format_since` /
  `async_since` untouched.
- **shared/testing:** replay mode fakes whichever credential fields the
  doc declares (it hard-coded `{apiKey}`); `liveSkip` opens on either env
  convention.
- **Fixtures are SYNTHETIC** — no ContactOut key is held in this repo. Every
  body is taken from the v1 adaptor tests or the public API reference and
  every file says so in its `description`.

## Capabilities

- `contactout-connector`.

## Non-goals

- Not ported (v1 scope decisions 2026-08-27 / 2026-09-01, unchanged): the
  bulk trio (sync ≤100 and async ≤1000 contact batches, the async verify
  batch — agents loop the single endpoints), the Campaigns API (shared
  vendor account: list/get would leak every tenant's campaigns, start/stop
  sends real email), and the Hashed Email API (deferred until an ad-ops
  use case exists).
- No dollar conversion in the doc. v1's contract rates (work email $0.07,
  personal email $0.17, phone $0.16, search $0.018, verifier $0) and its
  list rates / margin are the broker card's job (owner rule 2026-09-15).
- No `output.fromResponse`: v1 stamped its unit counters onto the output;
  v2 publishes them as `usage.evidence`, and ContactOut bodies carry no
  billing field to strip.
- No new category leaves (`people-enrichment`, `company-enrichment` exist),
  no new `Unit`, no new auth preset (the two injects are spelled inline —
  the opoint posture — because `presets.auth.header` reads `apiKey`).
- No live recordings until a key is available (tasks.md).

## Impact

New connector tree + `openspec/changes/add-connector-contactout`. Engine
patch bump 0.2.1 for the resolver change (`engine/transport.ts`,
`engine/auth.ts`, `engine/mod.ts` are version-check contract paths); no
compiled doc other than contactout's changes. `DEVELOPMENT.md` Authoring
guide gains the multi-key credentials rule.
