# Design: add-connector-contactout

Only the choices the port was FORCED to make. Everything not listed follows
the precedents named in `.claude/commands/provider-port.md` (sync GET →
akta, sync POST → exa, multi-pool → clay).

## D1 — Two keys: `auth.credentials` and `auth.inject` are endpoint facts

Monid holds two type-restricted ContactOut keys — a WORK-email key and a
PERSONAL-email key — two accounts, each with its own email / phone / search
pools, each returning only its email kind. v1 selected the key per def
(`keyKind`) inside an endpoint-scoped runtime.

Three options were live:

1. **One provider, one credential object, per-endpoint inject** (chosen).
   The provider declares `credentials: z.object({ workApiKey, personalApiKey })`
   — both keys, both required, v1 parity (`apiKeys: { work, personal }`) —
   and NO inject. Every endpoint declares its own inline `auth.inject`
   naming the key it sends: thirteen `data.params.workApiKey`, seven
   `data.params.personalApiKey` (owner call 2026-09-16: the shape is an
   account-level fact, "which key" is each endpoint's own line; no "one key
   is the default and the others override"). A provider-level inject is
   impossible here because the paired variants share a wire path, so the
   request alone cannot tell them apart — the same reason v1 keyed on the
   def, not the path. Consequence, eyes open: every compiled doc requires
   BOTH keys, so a host holding only one runs nothing — matching v1, where
   both were mandatory config.
2. Credential shape declared per ENDPOINT (`{workApiKey}` on thirteen,
   `{personalApiKey}` on seven), so a doc requires only its own key and a
   host holding one key still runs that half. Built first, withdrawn: the
   shape is the account's, not the endpoint's, and twenty repeated
   declarations bought a partial-key mode nobody asked for.
3. Two providers (`contactout`, `contactout-personal`). Zero engine or test
   changes, but six ids change (monid-services routing), the shared zod
   fragments duplicate (no cross-provider imports), and one account's
   pools split across two providers.

Neither preset fits: `presets.auth.header(name)` reads `data.params.apiKey`,
and the two shapes deliberately name their keys. Both injects are spelled
inline (the opoint posture, owner call 2026-09-15). The thirteen work
injects intern to ONE fnTable entry and the seven personal ones to another.


## D2 — Seven pools in vendor credits; no `usage.consolidate`

`/v1/stats` is key-scoped: each account meters `remaining` (email),
`phone_remaining` and `search_remaining`. The verifier pool is a free
bundle both keys draw from that `/v1/stats` does not expose. So the
provider declares `email_work`, `phone_work`, `search_work`,
`email_personal`, `phone_personal`, `search_personal`, `verifier`, and
each compiled doc narrows to the pools its lines drain (pdl D6). Pools are
the vendor's own unit — every line is `amount: 1` credit; v1's contract
$/credit (work email 0.07, personal 0.17, phone 0.16, search 0.018,
verifier 0) and its list rates are the broker card's job.

No response carries a consumed amount, so there is no `consolidate` and no
`usage.mismatch.derived` cross-check. The rates are held by literal
assertions in the tests (clay D7a): every line `amount === 1`, every pool
suffixed by its key kind, every doc's `credits` equal to the set its lines
drain — plus the deep-equality usage checks per fixture.

## D3 — The either/or search credit is a COUNTING rule

Drill-verified (2026-08-24 / 2026-09-01): on `/v1/linkedin/enrich` a
profile that returns contacts draws email and/or phone credits; a profile
that returns none — `profile_only=true`, nothing on file, or only the OTHER
email kind (this key answers those arrays empty) — draws exactly one search
credit. v1 modelled this as a TIERED card whose contact rows were priced
NET of the search credit. In v2 the three credits are three PER_UNIT lines
at 1 credit each and `evidence` puts the search count on
`email === 0 && phone === 0 ? 1 : 0` (D19: selection is a counting rule,
never a model shape). `/v1/email/enrich` mirrors the same counter (v1
`enrichUnits`); `/v1/people/enrich` bills the search credit on EVERY match
(v1 `peopleEnrichUnits`) and so has no either/or.

Both profile dialects are read in one counter: snake_case arrays (`email`,
`work_email`, `personal_email`, `phone`) and camelCase scalars (`workEmail`,
a string `email` / `phone` — `/v1/email/enrich`, drill 2026-09-01). Which
KIND an address is follows from the KEY, so one email counter serves both
variants and the pool in the model says whose credit it is.

## D4 — Misses are free, in both shapes

`/v1/linkedin/enrich` answers a miss as HTTP 200 with `profile: []` — an
array, not an object — so the counters treat anything but an object
profile as zero everywhere. `/v1/email/enrich`, `/v1/people/enrich`,
`/v1/people/person` and the contacts-only lookups answer 404, which the
engine settles as error-as-data with forced zero usage before any fn runs.
Search and company endpoints answer empty collections — zero rows, zero
draw, evidence still reports the zeros.

## D5 — Public identity: the v1 suffixes, on a shared wire path

Six operations exist under both keys on ONE wire path each, so the derived
`?? request.path` id would collide. The ids are pinned to v1's:
`/v1/linkedin/enrich/work-email` and `/v1/linkedin/enrich/personal-email`
(bytedance's shared-path precedent). The eight singles keep their wire
path as id, underscores included (`/v1/people/linkedin/work_email_status`
— `zEndpointPath` admits `_`, minimax precedent). Endpoint folders are
flat and unique (`linkedin-enrich-work-email`, …) because the loader
requires provider-wide unique leaf names and a `work-email/` leaf would
repeat six times.

## D6 — v1 refinements: notes, one `anyOf`, and the formats that survive

- Cross-field rules move to `meta.notes` (DEVELOPMENT.md rule): the
  people-search pairwise exclusions, people-enrich's "primary identifier OR
  name + secondary" (a union would need eight arms over twelve fields),
  company-search's "at least one filter" and "year_founded_to requires
  year_founded_from". Upstream answers 400 (error-as-data).
- Decision-makers' "at least one of linkedin_url, domain, or name" binds
  as `z.union` of three `.required()` variants → a three-arm `anyOf` with
  one-key `required` each (clay D13 form). It binds at the ENDPOINT rather
  than the mirror only so the mirror stays a plain object every consumer
  can `.extend()`.
- Single-field rules stay enforced: the LinkedIn profile URL regex, the
  company URL regex, `z.email()` (`format: email` + pattern; ajv-formats is
  loaded), enums, `min`/`max`. `.strict()` everywhere — upstream silently
  ignores unknown parameters, so a typo would otherwise pass unnoticed.

## D7 — Query booleans and enums stay honestly optional

`profile_only`, `include_phone`, `email_type`, `reveal_info` are read by the
estimates. The rule of thumb says "behaviour knobs the estimate reads get
the vendor default at the binding", but here they stay optional and the
fns read `=== true` / `=== "none"`:

- decision-makers binds a `z.union`, and ajv does not apply `default`
  inside `anyOf` arms — a binding default there would be dead;
- a materialized default rides the WIRE (D24), and `profile_only=false` on
  every call is noise the caller never sent, with no live key to confirm
  the vendor treats it as absent;
- absent IS the vendor's default, so `undefined === true` is deterministic
  post-validation — the same honest-optionality D25 grants arrays
  (`arr?.length ?? 0`), applied to booleans.

The four contact-info / linkedin-enrich bindings are therefore the bare
mirrors, consistent across the provider.

## D8 — Limit knobs: `page_size` required; fixed pages deduced

`/v1/people/search` `page_size` is the estimate's whole basis → REQUIRED at
the binding (the vendor defaults it to 25; D25 says the caller states the
cap). `/v1/people/decision-makers` IGNORES `page_size` (fixed 25 — drill)
and `/v1/company/search` has no knob (`metadata.page_size` is always 25):
both promise 25, a quantity DEDUCED from the vendor, not a fallback.
`/v1/domain/enrich` promises `domains.length` (1–30).

## D9 — Engine: `<NAME>_CREDENTIALS` for non-`{apiKey}` shapes (0.2.1)

The local resolver read one variable and produced one key
(`CONTACTOUT_API_KEY → {apiKey}`), keyed by PROVIDER — it cannot know the
endpoint, so a personal-key doc could never be run locally. Options:
a per-field convention (`CONTACTOUT_WORK_API_KEY`) needs either the doc's
schema in the resolver (a public-interface change) or an env scan by
prefix; a JSON object in one variable mirrors the credentials object
one-to-one and changes no signature. Chosen: `<NAME>_CREDENTIALS` (a JSON
object of string values) wins when set, else `<NAME>_API_KEY → {apiKey}`;
a malformed object is MISSING_CREDENTIAL, never a silent `{}`. The hint in
the injector's error names both variables.

`engine/transport.ts`, `engine/auth.ts` and `engine/mod.ts` are
version-check contract paths, so the engine moves 0.2.0 → 0.2.1. No hook
ABI, doc format or lifecycle surface changed: the three `since` fields in
`config.yml` stay.

Replay mode in `shared/testing/runner.ts` hard-coded `{apiKey: "test-key"}`
and would fail every contactout doc with MISSING_CREDENTIAL; it now fakes
whichever fields the doc's compiled credentials schema requires.
`liveSkip` opens on either variable.

Hosted: the Relay hands the engine a `Record<string, string>` from the
Broker; two fields fit. Provisioning both secrets for `contactout` is a
monid-services task (v1 already holds `CONTACTOUT_API_KEY_WORK` /
`_PERSONAL`).

## D10 — Synthetic fixtures

No ContactOut key is held in this repo, so every fixture is
`synthetic-` prefixed and unverified against live traffic. Bodies come from
the v1 adaptor tests (the profile dialects, the object-vs-array `profiles`
and `companies` shapes that were real under-billing bugs in v1) and the
public API reference (checkers, count, person, verify, error envelope).
Live tests are written and gated on `CONTACTOUT_CREDENTIALS`. Re-recording
is the first open task.

## D11 — Contacts-only `email_type=none` draws no email credit

v1's TIERED card needed a `default` row so the catalog would show a price,
and made the email credit that default — so a phone-only lookup
(`email_type=none`) was billed the email base too, accepted 2026-09-08 as
a card limitation. The proposal's own drill note says the measured draw is
nothing on the email pool. v2 has no such constraint: the estimate holds
the email line only when `email_type !== "none"`, and evidence counts what
came back. A deliberate divergence from v1's card toward v1's measurement.

## D12 — Provider-level hooks: fromError only

- `fromError` digests the flat `{status_code, message}` envelope (real
  behaviour, drill-verified: 401 bad token, 400 bad input, 404 miss, 403
  out of credits, 429 + retry-after — the documented table is swapped) and
  keeps the raw body.
- No `toRequest`: query values are scalars, bodies are JSON as authored.
- No `fromResponse`: nothing to strip (D2). v1's additive unit stamps are
  `usage.evidence` now.
- `request.headers: { Accept: "application/json" }` mirrors v1's request
  (bytedance precedent). Timeouts 60 s / 120 s from
  `endpointExecution/config.yml`; no pollMs (all sync).

## D13 — v1 `notes` → `meta.notes`; `hints` → description prose

Each def's v1 pricing note becomes one `meta.notes` entry (plus the
cross-field rules from D6); the provider states the three facts true of
every endpoint (no dedupe, per-profile not per-address, misses free). v1
`hints` ("only need the contact details → LinkedIn Contacts Only") are
"what to call next", so they fold into `description` as prose (clay D11).
`displayName`s keep v1's wording ("Search People (Work Email)") — the
two display-name styles in the library are an open owner decision.
