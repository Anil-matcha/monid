# AI Agent Instructions for monid-ai/monid

Guide for AI coding agents working in this repo. Read this first, then the
relevant `openspec/changes/*/design.md` before touching code.

## What this repo is

The open connector standard for [Monid](https://monid.ai). Connectors are
authored in TypeScript (`defineProvider` / `defineEndpoint`: zod schemas + a few
small, closed-term functions), compiled into inert JSON **EndpointDocs** + a
content-addressed **fnTable**, and executed by a small generic engine. Two
released artifacts:

1. `engine/` — the generic connector engine (`@monid/connector-engine`).
2. `.output/catalog.json` — the compiled connector bundle (built by CI, never
   committed).

The legacy imperative provider adaptors live in the sibling repo
`monid-services` (`services/shared/providers/adaptors/*`); connectors are being
migrated here change-by-change.

## Structure

```
connectors/<name>/            # provider.ts + endpoints/<e>/{endpoint.ts, schema/, endpoint.test.ts, fixtures/}
engine/                       # load -> link -> execute; transports; host ABI (ctx.utils)
shared/core                   # THE contract: def/doc/hook/bundle zod schemas, presets
shared/compiler               # pure Def -> Doc mapping, fn normalization + interning
shared/testing                # testSealedUnit / runEndpoint, fixture record+replay
shared/{logging,app-config}   # logger + layered config
scripts/                      # CLI entrypoints (compile, run, catalog, record, version-check)
openspec/                     # spec-driven changes; decision record in changes/*/design.md
config.yml                    # schema.*/compiler.* = CONTRACT (no env overrides); engine/scripts = tooling
```

## Commands

```bash
deno task check && deno task test    # types + replay tests (zero network)
deno task test:live                  # live tests; auto-skip without <PROVIDER>_API_KEY
deno task engine:run 'exa#search' --body '{...}'   # JIT-compile + execute one endpoint
deno task catalog providers|endpoints|inspect <id>
deno task record <id> ...            # record real fixtures (headers dropped)
deno task compiler:compile           # full-repo deterministic compile
deno task version:check              # semver gate for ABI/format changes
deno task apify:scaffold <actorId>   # authoring-time actor input-schema scaffold
```

## Core invariants (do not regress)

- **Determinism**: the compiled bundle is a pure function of repo content.
  `schema.*`/`compiler.*` config loads override-free; compile iterates sorted;
  hashing is RFC 8785. Double-compile must be byte-identical.
- **Closed-term fns**: hook functions have no imports/captures (TS-AST linted;
  whitelisted pure globals only). All IO flows through the engine's ONE
  transport port — the pure hooks do no IO at all; the three lifecycle hooks are
  effectful-by-capability via `utils.http`/`utils.request` (auth injected at
  egress ONLY for same-origin targets — D16; fns never see credentials).
  Cosmetic edits must not change a fn hash (normalization guarantees this).
- **Hooks (nine)**: six PURE — `auth.inject`, `input.toRequest`,
  `usage.consolidate`, `usage.estimate` (pre-run cost, no IO),
  `output.fromResponse`, `output.fromError` — plus the EFFECTFUL lifecycle
  family — `lifecycle.start`/`poll`/`stop` (async run protocol; monid-services
  `runLifecycle`-shaped). One fallback rule: endpoint ?? provider ?? config
  default, leaf-wise, closest wins.
- **Async protocol**: `request` stays REQUIRED and is DATA into the lifecycle
  (`ctx.data.request`); `lifecycle.start` (when present) replaces the engine's
  declarative execution and returns `RUNNING{state?}` |
  `COMPLETED{httpStatus, output, state?}` (RunKind, UPPERCASE) — WHOLE-STATE
  semantics: a present `state` IS the complete next fn-state (replaces
  wholesale), an absent one carries the previous forward (no field merge — D21).
  State is STRUCTURED (`zRunState`): fn-owned `externalRunId`/`stage`/`data`
  (ids + billing signals; typed per doc via `lifecycle.state` → `stateSchema`) +
  ENGINE-owned `timing` (the ClickHouse provider slices; `RunCompleted.timing`
  reports at settle, sync runs included) — engine-capped
  (`schema.state_max_bytes`). `timeouts.pollMs` is the cadence default, per-tick
  `pollAfterMs` overrides. Every doc floors at `schema.fn_abi_since`.
- **The def IS the rate card (D26 — reverses D18)**: `usage.model` declares the
  billing ALGEBRA per endpoint — LEAF (`FREE` never-bills / `PER_CALL` flat /
  `PER_UNIT` metered, optional block-rate `every`, default 1) and AND
  (`COMPOSITE` with components keyed by OUR snake_case ids; the vendor's native
  spelling, when it differs, is the line's `vendor` FIELD — the join is
  `vendor ?? id`) — and every billable line pins `consumes: {credit, amount}`
  against a credit system declared in `usage.credits` (resolved KEY-WISE,
  endpoint over provider — the pool SET is a provider-wide fact: a provider
  declares every pool its account meters, single-pool providers `default`, a
  dollar-priced vendor's pool IS dollars, pdl one per `x-call-credits-type`;
  each declared pool must be DRAINED at its declaration site — a provider's by
  ≥1 endpoint, an endpoint's by that endpoint — and the compiled doc narrows to
  the pools its own lines drain, D6). Conditions/offsets/selection are COUNTING
  rules owned by consolidate/estimate, never model shapes (D19 — no
  VARIANT/TIERED kinds). The settle splits into TWO one-job fns (D27,
  subclassing: the PROVIDER states the default, the ENDPOINT overrides only what
  diverges): `usage.evidence` (envelope → `{counts}` — per-line quantities,
  estimate's settle-side twin, endpoint-divergent) and `usage.consolidate`
  (envelope → `{credits, output?}` — the VENDOR'S OWN meter lifted out of the
  payload in one motion via `utils.json.pluck`, provider-uniform, OPTIONAL: not
  every vendor reports one). Compiled doc: model/credits/estimate/evidence
  REQUIRED — for meterless models (FREE/flat) the compiler SYNTHESIZES the one
  lawful `() => ({counts: {}})` (`core#usage.synthesizedEmpty`, one shared
  fnTable entry); metered models must resolve both quantities fns. Estimates
  read the PRE-toRequest validated input (typed body AND queryParams — D25).
- **Input fidelity (D25)**: `schema/inputs.ts` is the faithful vendor mirror —
  optionality only, no `.default()`, unquoted identifier keys. ALL tightening
  lives at the BINDING, derived: `zBody.required({limit: true})` (primary
  limiting knobs — the caller states the cap) /
  `.extend({f:
  shape.f.unwrap().default(n)})` (behavior knobs, verified actor
  defaults) / `.unwrap().min(1)` floors ONLY where the vendor documents 0 =
  unbounded. Multiplier arrays are never tightened — optional arrays read
  `arr?.length ?? 0` (honest optionality); empty input ⇒ estimate 0. Never
  invent structure the mirror doesn't have. Quantities fns return `{counts}` —
  per metered line only (no rate math, no receipt plumbing). The ENGINE owns the
  fold (D26, at estimate AND success settle): it appends the model's flat 1s
  (composite flats under their line id; leaf PER_CALL under the reserved `CALL`
  key — not a Unit; fns never write flat keys, type + runtime rejected) and
  folds `ceil(quantity / every) × consumes.amount` per line into the public
  `usage = {credits, evidence}`. Then the VENDOR'S CLAIM settles (D27): the
  consolidate fn's non-empty `credits` WINS (source of truth — zero entries
  prune, unreported entries are OMITTED, never `?? 0`; an empty claim falls back
  to the derived fold), pool ids must be declared credit systems (FN_CONTRACT),
  and a disagreement beyond 1e-9 rides out as `usage.mismatch.derived` — our
  fold, said and logged, never failing the run. Anyone holding the doc
  re-derives the fold from evidence × rates. Error settles are
  `{credits: {}, evidence: {}}` — no meter read. Scalars carry optional `label`s
  ("base fee", "reviews") — display metadata; the id is the join. ≥2 metered
  components require doc-level fns (compile-checked); estimates are DEDUCED,
  never defaulted: no fallback constants — limiting knobs are either
  actor-verified schema `.default(n)`s (materialized into body AND queryParams
  before any hook) or REQUIRED at the binding site (`zBody.required({...})` in
  endpoint.ts; schema files stay actor-faithful). The engine validates fn counts
  against the model at settle AND estimate (FN_CONTRACT) before the fold.
  `deno task engine:estimate` prints just the answer — `{credits, evidence}`.
  **Drift vs tests (D28/D29)**: `deno task drift [--provider] [--fix]` is THE
  vendor-world guard — per-provider suites (scripts/drift/) poll published
  surfaces; the apify suite checks pricing (regime/shape/derived join/pinned
  Business-tier rates — against the EFFECTIVE pricingInfo, latest startedAt <=
  now, with scheduled-pin reconciliation: a pin matching an upcoming price
  passes with an UPCOMING notice), COVERAGE (every published billable event is
  modeled or in the documented EXCLUDED map — the D29 completeness rule: an
  input-gated line the model omits makes estimates silently wrong the moment
  that input is used), input schemas (live.required ⊆ compiled.required), and
  output schemas (report-only) in one pass, scheduled weekly
  (.github/workflows/drift.yml). Fix policy: `--fix` re-scaffolds drifted
  schemas (generated; git diff reviews) and writes rate drift + scheduled
  changes to .output/drift-repin.json — pinned amounts are never auto-rewritten.
  Where an actor publishes storages.dataset.fields, the doc carries a scaffolded
  `output.schema` — passthrough documentation (all-optional, item.or(record):
  validation cannot fail a paid run). Providers without a machine-readable
  surface are guarded by test:live + the D27 per-run mismatch signal (the runner
  says so); the mismatch signal also cross-checks apify's pinned rates on EVERY
  run.
- **Typed authoring (D19a/D23)**: `defineEndpoint` is generic over the model,
  the input body schema, and the lifecycle state schema — counts keys narrow to
  the model's LITERAL metered keys, `data.input.body` is `z.output` of the doc's
  OWN schema, and the fn-owned `state.data` bag is typed at read AND write sites
  when `lifecycle.state` is declared. The rule: TYPED where a doc-declared,
  engine-validated schema exists (body, lifecycle.state); Json where raw (vendor
  output, error envelopes) — worked with `utils.json`. There are NO estimate
  presets — a typed inline fn on the doc IS the typed preset (preset field args
  were unchecked strings); presets survive only at provider seams
  (`presets.auth.*`, `presets.usage.perCall`). Ctx facts live at
  provenance-named paths: `data.usage.model`, `data.lifecycle.state`.
- **Billing before presentation**: `usage.consolidate` is OPTIONAL (D27 — not
  every vendor reports a meter; clay, pdl and tinyfish ship without one) and,
  when present, runs on the RAW response envelope BEFORE `fromResponse` —
  presentation changes can never change a bill. Vendor non-2xx is DATA (zero usage), not an exception;
  lifecycle fns synthesize error statuses for in-body failures and the engine
  zero-bills every non-2xx envelope (a fn cannot bill an error).
- **Versioning**: every doc carries compiler-derived `minEngineVersion`.
  Connector-only changes never bump the engine. Any hook-ABI or doc-format
  change requires an `ENGINE_VERSION` minor bump + `doc_format_since`/
  `fn_abi_since` facts in `config.yml`, guarded by `deno task version:check`.
- **Tests run the artifact**: `testSealedUnit(id)` compiles the whole repo and
  tests the sealed unit (doc + its fn entries), replaying `fixtures/*.json`.
  Live tests gate on `<PROVIDER>_API_KEY`; synthetic fixtures carry a
  `synthetic-` filename prefix until real recordings exist. Fixtures are MINIMAL
  SHARED CHAINS (fixture strategy v2): provider-level
  `connectors/<provider>/fixtures/<shape>.json` with a required `description`
  and `{{request.url}}`/`{{request.origin}}` bindings — one chain serves every
  endpoint. `record` trims (arrays/strings capped) and ALWAYS scrubs PII; the
  fixture-size lint bounds files (warn 32 KiB / fail 128 KiB).

## OpenSpec workflow

`openspec/` is spec-driven: every non-trivial change gets
`openspec/changes/<name>/{proposal.md, design.md, specs/<capability>/spec.md,
tasks.md}`.
The decision record (D-numbered) lives in `design.md` — read
`openspec/changes/define-endpoint-doc-and-engine/design.md` (D1–D29) before
extending the schema or engine. `openspec/specs/` is populated on archive.

The async run protocol (D10/D29's reserved surface) is IMPLEMENTED — see
`openspec/changes/add-async-run-protocol/design.md`. Still reserved: resources
(removed in D19), metered/accruing endpoints, declarative poll/stop phase arms,
`stop` result reporting — "return with a concrete need, as their own change".

A connector port that needs no schema/engine change carries no `design.md`: the
proposal plus `specs/<capability>/spec.md` and `tasks.md` are the record (see
`openspec/changes/add-connector-firecrawl/`). Reach for a `design.md` only when
the contract itself moves.

## Conventions

- Deno 2 workspace; fmt `indentWidth: 4`; import aliases `@shared/<name>`.
- Endpoint ids are `<provider>#<endpoint>`, inferred from folder names — never
  authored.
- New hook = contract file in `shared/core/schema/hooks/` + section carrier +
  doc `zFnRef` slot + `fnKeysOf` entry + `linkFns` branch + engine phase +
  version bump. Follow the existing pattern end-to-end.
- Commit style: `<type>(<scope>): <subject>` (e.g. `feat(engine): ...`,
  `feat(connectors): ...`, `docs(openspec): ...`).

## Gotchas worth knowing before you write a fn

Hard-won, each one costs an hour if you meet it cold:

- **Fn bodies are executable JS, not TS.** The engine reinstantiates the source
  in an empty scope, so a type annotation is a syntax error at run time. That
  collides with `noImplicitAny`: a standalone helper lambda
  (`const has = (name) => …`) has no contextual type and fails `deno check`,
  while the SAME logic inline in a `.map()` / `.some()` / `for…of` infers fine.
  Write the inference-friendly form —
  `const names = xs.map((x) =>
  typeof x === "string" ? x : x.type)` then
  `names.includes(…)` — rather than reaching for a cast.
- **Closed-term globals are a whitelist** (`shared/compiler/lint.ts`): `JSON`,
  `Math`, `Object`, `Array`, `String`, `Number`, `Boolean`, `Error`, `Promise`,
  `encodeURIComponent`. Notably **`URL` is not on it** — parse a host with
  string ops, not `new URL()`.
- **`utils.json.omit` is DEEP, `pluck` is EXACT.** To lift one receipt field out
  of a payload use `pluck(output, "$.field")` — `omit` walks the whole tree and
  will also strip an identically-named key nested inside the data.
- **Identical fn sources intern to ONE fnTable entry.** Closed terms cannot
  import a shared helper, but duplication is free when the sources are
  byte-identical after normalization — so derive per-endpoint differences from
  ctx (`data.request.url + "/" + id`) instead of hardcoding a path, and the
  three copies collapse to one entry. Assert it in a test; `deno task fmt` will
  not break it (normalization strips formatting).
- **Provider-level hooks fall through to EVERY endpoint.** A provider
  `lifecycle.start` replaces declarative execution on the provider's synchronous
  endpoints too. Mixed sync/async providers must author the lifecycle on the
  async endpoints.
- **Fixture `{{request.url}}` bindings substitute in recorded REQUEST urls
  only** (`replayFetch`), never in response bodies. An opaque cursor a fn reads
  back out of a body (a pagination `next`) must be a literal absolute url in the
  fixture.
- **A vendor cursor is not a caller-usable url.** If following it needs the
  credential the engine holds, the fn must follow it — handing it back hands the
  caller a URL they cannot fetch.
