# connector-schema (delta)

## MODIFIED Requirements

### Requirement: usage.model — the billing ALGEBRA; the def IS the rate card (D26)
`zUsageModel` SHALL be the discriminated union of two operators, one kind
per file under `usage/model/` with the runtime kind enum DERIVED from the
union (extractZodDiscriminatorKeys — the v1 zPriceTypes pattern; a
literal-typed authoring const is kept in sync by a load-time staleness
guard):
- LEAF: `FREE` ({kind} only — never bills, design D25: no description/
  label, the kind says everything; never a composite component),
  `PER_CALL` ({kind, consumes, vendor?, label?, description?} — billed
  1 iff success, engine-evidenced under its line id — design D24/D26)
  and `PER_UNIT` ({kind, unit, every?, consumes, vendor?, label?,
  description?} — metered per N of unit; pure, no base-fee side
  pocket). `description` is a human note on what a derived count means;
  `label` (≤40 chars, OPTIONAL) is a SHORT display name for billing
  surfaces ("base fee", "reviews", "extra results") — rendering is
  services-side with the KEY as fallback (`${label ?? key} × ${count}`);
  neither is ever a join key.
- AND: `COMPOSITE` ({kind, components: `Record<componentId, scalar>`,
  min 2}) — scalar components KEYED BY ID (design D19): id uniqueness is
  structural, and the old constraints (≤1 PER_CALL, distinct PER_UNIT
  units) are DELETED — the key disambiguates, so two flat rates
  (tiktok-comments) and two same-unit rates (linkedin) are representable.
  No nesting.
No VARIANT kind (deleted — design D19) and no TIERED kind: conditions,
offsets and input-selection are COUNTING rules owned by the
evidence/estimate fns (a gated line counts 0 when off; a select-one
populates only the selected key; exa's base-covers-first-10 is
`max(0, n − 10)`); volume schedules stay counting facts, never model
shapes. Every BILLABLE line (PER_CALL and PER_UNIT, leaf or composite
component) REQUIRES `consumes: {credit, amount}` — the def IS the rate
card (design D26, reversing D18's rate-free rule: the tier is one
provider-wide constant, the per-line prices are vendor-published facts
surveyed live; credit → money stays the ONE services-side fact).
PER_UNIT carries optional `every` (int ≥ 1, `.default(1)` MATERIALIZED
at parse — the define generic constrains on `UsageModelSeed` = z.input,
since seed and output diverge on the default): `amount` buys `every`
units, folded in whole increments. Line ids are OURS — snake_case,
MINTED from the vendor's native names by one transform (revises D19's
verbatim-key rule); drift guards DERIVE the join by re-applying the
transform to live names at check time (design D28 — the interim
`vendor` field is deleted: it carried no information the id doesn't).
`usage.credits` sits BESIDE the model — `Record<creditId, {label?,
description?}>`, resolved KEY-WISE endpoint over provider (design D6,
revising D26's whole-map provider-first rule: the POOL SET is a
provider-wide fact — a provider declares every pool its account meters,
single-pool providers using id `default`, multi-pool vendors naming
each after the vendor's own type — and an endpoint adds or restates
only what diverges, the D20 leaf-wise rule).
`zUsageSection` carries `model?`, `estimate?`, `evidence?` and
`consolidate?` per level — but the model MUST RESOLVE (endpoint ??
provider, compile error if neither: every doc declares what is
chargeable). `doc.usage` carries the resolved `model` REQUIRED inline
(hash-covered), `credits` REQUIRED and NARROWED to the pools THIS doc's
lines drain (design D6 — the resolved declaration filtered by
`consumes.credit`, so a doc never carries a pool it cannot draw; `{}`
for FREE — an endpoint-level declaration on a FREE doc is a compile
error, dead config), `estimate`
AND `evidence` as REQUIRED FnRefs (the quantities pair, design D27),
and `consolidate` as an OPTIONAL FnRef — present exactly when the
vendor reports a meter. When NEITHER endpoint nor provider declares
estimate/evidence AND the model has no metered lines (FREE / flat —
`hasMeteredLines`), the compiler SYNTHESIZES the one lawful fn
`() => ({counts: {}})` into the missing slot: a real interned fnTable
entry, ONE shared entry repo-wide, provenance
`core#usage.synthesizedEmpty` — the compiled doc stays comprehensive
with nothing to author. Metered models must still resolve BOTH
quantities fns (HOOK_UNRESOLVED if either is missing — the
deduced-estimate guarantee); a ≥2-metered composite forces DOC-level
evidence AND estimate. `presets.usage.perCall` SHALL NOT exist
(deleted, design D27): a flat doc's settle is a forced move, so there
is nothing to author at all. Compile checks: credits must resolve for
billable models; every `consumes.credit` references a declared id; and
NO declared pool is dead config — a PROVIDER pool SHALL be drained by
at least ONE of its endpoints (checked once per provider, after its
endpoints compile), an ENDPOINT pool by that endpoint (it is
endpoint-scoped config).

#### Scenario: Metered doc must resolve both quantities fns
- **WHEN** a PER_UNIT doc resolves neither an endpoint- nor provider-level usage.evidence (or usage.estimate)
- **THEN** compile fails HOOK_UNRESOLVED — the model has metered lines, so nothing can be synthesized

#### Scenario: FREE doc compiles with no fns — synthesis
- **WHEN** a FREE-model doc declares no usage fns at any level
- **THEN** it compiles; its estimate AND evidence refs both point at the ONE shared `core#usage.synthesizedEmpty` entry

#### Scenario: Undeclared consumes.credit fails compile
- **WHEN** a line pins `consumes: {credit: "tokens", amount: 1}` but the resolved usage.credits declares no `tokens` pool
- **THEN** compile fails naming the undeclared credit id

#### Scenario: Provider pool drained by ONE endpoint compiles
- **WHEN** a provider declares four pools and each of its four endpoints consumes exactly one of them
- **THEN** every doc compiles, each carrying ONLY the pool its own lines drain

#### Scenario: Undrained provider pool fails compile
- **WHEN** usage.credits on a provider declares a pool no endpoint of that provider consumes
- **THEN** compile fails naming the provider file — dead config

#### Scenario: Undrained endpoint pool fails compile
- **WHEN** an ENDPOINT declares a pool its own lines do not consume
- **THEN** compile fails naming the endpoint — an endpoint-level declaration is endpoint-scoped

#### Scenario: Endpoint credits override the provider's key-wise
- **WHEN** a provider declares `{default: {label: "Provider"}}` and an endpoint declares `{default: {label: "Endpoint"}}`
- **THEN** the compiled doc carries the ENDPOINT's entry — closest wins, per key

#### Scenario: every defaults to 1 at parse
- **WHEN** a PER_UNIT line omits `every`
- **THEN** the compiled model carries `every: 1` explicitly — materialized once, never re-derived downstream
