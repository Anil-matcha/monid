# Design: add-connector-clay

Decision record for the clay port (v1 `adaptors/clay`, 10 defs). Only the
choices the declarative model forced are recorded; everything else mirrors
v1 verbatim.

## D1 — Three pools, declared once on the provider

Clay meters against three INDEPENDENT vendor units, and a run of one family
never touches the other's: data credits and actions (enrichment), and the
subscription's annual search-results quota (search). v1 collapsed all three
into dollars at Launch-plan rates; the pool rule (2026-09-15) keeps the
vendor's own units, so the doc declares `data_credit`, `action` and
`search_result` and the broker card converts. This is only declarable in ONE
place because of the pdl fix (its D6): credits resolve key-wise and a
provider-declared pool must be drained by at least one ENDPOINT, not by every
one. Each compiled doc then narrows to the pools its own lines drain —
`clay#enrichment/mobile-phone` carries `data_credit` + `action`,
`clay#search/query-mode/run` carries `search_result`, and the two FREE docs
carry none. Rejected: declaring the pools per endpoint (correct, but states
an account-wide fact ten times); a single "US dollars" pool (violates the
rule, and cannot express a quota row — `consumes.amount` must be positive,
so a $0 row would force the doc FREE and lose the quota gate entirely).

## D2 — One line per pool per quantum

A line pins exactly one `consumes.credit`, but ONE routine run draws from two
pools simultaneously. So each quantum is expressed as a PAIR of PER_UNIT
lines over the same unit — `enrichment_credits` (data credits) and
`enrichment_actions` (actions) — both counted by the same quantity. The
alternative, a flat PER_CALL pair, was rejected for D3's reason: a flat line
always bills on success, and a Clay miss is a success that draws nothing.
Consequence: `usage.evidence` reports the same number twice under two ids.
That reads redundantly but is exactly right — the evidence is the quantity
each line is folded at, and the two lines fold into different pools.

## D3 — The miss is a quantum, and mobile-phone prices it

Measured (drills 2026-08-20 / 2026-09-08, `clay credits balance` diffs closed
to ±0): six of the seven functions draw NOTHING when the waterfall completes
empty, and Mobile Phone draws a reduced 0.5 data credit + 1 action. v1 billed
the caller 0 units in both cases and recorded Mobile Phone's charge as an
internal `actualCost` the platform absorbed. The doc is the vendor's rate
card, not a pricing policy, so the reduced draw is now a pair of real lines
(`miss_credits` / `miss_actions`) and the settle reports what Clay took;
whether the caller pays is the broker's decision, made with the fact in hand
instead of without it. The condition stays a COUNTING rule (D19): the model
prices four lines, and `usage.evidence` — the one doc-specific fn in the
connector — partitions completed items into filled and empty. A `failed` item
is neither: Clay charges nothing for it, so it counts toward no line.
Verified live: a deliberate miss settles `{data_credit: 0.5, action: 1}`.

## D4 — Search rows draw the quota pool, not dollars

Rows cost us nothing incremental — the annual quota is bundled with the
subscription — but they are strictly finite (Launch: 1M/year, HTTP 402 past
the cap; prod burned 70% in 45 days while rows were free). v1 answered with
an authored $0.001/result user price that bypassed markup. That is a platform
gate, not a vendor rate, and has no home in a doc. The honest model is that a
row draws one unit of a real, exhaustible pool: `search_result`. Clay's own
meter counts rows RETURNED, not the requested limit (drill-verified against
`period_quota.used`), so evidence counts `data.length` and an exhausted
iterator draws nothing.

## D5 — The lifecycle lives on the provider; the search docs relay

The routine protocol (submit one item → 202 `routine_run_id` → poll results,
202 = pending) is identical across all seven enrichment docs, so it belongs
at provider level like apify's. But `lifecycle.poll` only resolves when a
`start` does, so a provider-level poll obliges EVERY clay doc to have a
start — including the two free search lookups. Chosen: the provider owns the
routine-shaped pair, and the three search docs override `start` with a plain
relay (`utils.request()` → COMPLETED), inheriting a poll that can never fire.
Rejected: writing the routine pair on each of the seven docs (identical
source interns to one fnTable entry, so the artifact is the same — but a
later fix must be applied seven times or it silently forks). Cost, eyes open:
a free GET now runs through the lifecycle machine; it settles at
`timing.attempts: 0`, indistinguishable from the declarative path.

## D6 — `utils.http({path})` is ORIGIN-relative, so the poll repeats `/public/v0`

The lifecycle http port resolves `path` against the doc request's ORIGIN
(`engine/fn-utils.ts`: `url: o.url ?? origin + o.path`), not against
`request.baseUrl`. Clay's base carries a `/public/v0` prefix, so the poll
path is `/public/v0/routines/run/{id}/results` — a repetition that looks like
a mistake and is not. Apify never hit this (its baseUrl is a bare origin).
Pinned by the recorded fixture urls, which are what the engine actually
issued.

## D7 — Clay's own answer reaches the caller: no output hooks

v1 shaped Clay's payloads in two places, and neither is ported:

- **HTTP 402 substitution.** Clay's 402 body names our plan cap ("you have
  requested N of your M yearly limit"); v1 replaced it with a neutral message
  at the transport. Faithful relay wins here (owner call): the vendor's own
  answer is the run's answer. `output.fromError` receives no HTTP status, so
  a status-conditional swap would have to live in the lifecycle fns — the
  reversal is small and localized if the info-leak is later judged to
  outweigh fidelity.
- **`period_quota` strip.** REVERSED — v1 was right and the first cut of this
  change was wrong. See below.

Net: clay declares one `output.fromResponse` (the ledger strip) and no
`output.fromError` — a vendor refusal is the run's answer.

### `period_quota` is stripped after all

The first cut kept it, reasoning that it is "Clay's own response field and
useful to whoever is paging". Four things say otherwise:

1. **v1 stripped it deliberately** (`add-clay-provider` decision 7: "it is our
   account's quota ledger"). Reversing a considered decision needs a reason,
   and the one offered was wrong.
2. **The benefit does not exist.** `{limit, used, remaining, resets_at}`
   describes the WORKSPACE. One Clay workspace serves every tenant, so
   `remaining` tells a caller how much of a shared pool everyone else has
   burned. They cannot act on it: they do not own the quota, and their own
   metering arrives as `usage.evidence`.
3. **Every sibling strips this class of field.** fundable removes
   `credit_source` / `*_remaining` ("billing facts never reach the
   user-facing output"); ploid removes `remaining_credits` / `acu_remaining` /
   `acu_limit` and names the reason exactly — "the shared-workspace handle
   that must never reach a buyer (all tenants share one workspace)".
4. **We already treat it as secret.** D12 sanitizes these exact numbers out of
   the committed fixtures BECAUSE they are account state. Scrubbing them from
   a public repo while shipping them to every caller is incoherent — the
   runtime path is the one that reaches strangers.

It lands in `output.fromResponse`, not in `usage.consolidate`: consolidate is
the vendor-CLAIM hook and Clay makes no claim (D8), so using it to strip would
declare a meter that does not exist. Ordering is unaffected either way —
`usage` settles on the RAW envelope, before presentation.

Cost, eyes open: this repo's README is explicit that the same artifact "runs
locally with your own API key", and for a self-hosted user on their own Clay
key `period_quota` is THEIR ledger and genuinely useful. fundable and ploid
accept the same loss. It also sits in slight tension with relaying the 402,
which names the same cap — the line drawn is that a 402 is Clay explaining a
refusal the caller must understand, while `period_quota` is an account ledger
riding every successful page.

Two further v1 behaviours did not survive the port, both consequences rather
than choices, recorded so the diff is not silent:

- **The run-correlated item id.** v1 named the submitted item after the
  platform's run id when it had one (`runId ?? "item-1"`), for upstream
  traceability. `zLifecycleStartData` carries no run id, so the start
  hardcodes `"item-1"`. Nothing depends on it — Clay does not dedupe item
  ids, so it was naming, never idempotency.
- **The defensive 2xx-without-`routine_run_id` bill.** v1's
  `extractBilledUnits` returned 1 for any object body with no `data` array,
  so that path billed a full unit; here the evidence fn counts items and
  such a body yields 0. The honest answer: we have no evidence a routine ran.

## D7a — The rates have no runtime cross-check, so the test pins literals

D8's consequence deserves its own note. Where a vendor reports its own meter,
a drifted pinned rate surfaces as `usage.mismatch.derived` on every run.
Clay reports nothing, so nothing catches a wrong `consumes.amount` at
runtime — and a test that recomputes the expectation from the doc's own model
(`assembleUsage(doc.usage.model, …)`) catches nothing either, because the
engine folds credits FROM that model: both sides move together. So
`lifecycle.test.ts` carries the seven measured draws as LITERALS, asserts the
table covers exactly the enrichment ids, and holds the estimate to the same
numbers. One live enrichment case (`company-domain`, the cheapest
deterministic function) checks a real run against the same literal — and is
also the only thing that exercises the start's `items` wrapping, since replay
matches on method + url and never on a request body.

## D8 — No `usage.consolidate`: Clay reports no meter

Clay responses carry no cost field, so there is no vendor claim to lift and
the hook is simply omitted (D27 makes it optional; pdl and tinyfish are the
precedents — three of ten providers ship without one). Verified against the
recordings rather than assumed: across every captured shape the only
billing-adjacent key is `period_quota`, and that is a cumulative ledger, not a
per-call draw — no before-value rides the response, so nothing could derive
one from it.

`estimatedCreditCost` is NOT a meter and must never be lifted as one: the
drills found it wrong in both directions (Company Domain quoted 0.8, measured
1.0; Work Email quoted 1.1, measured 0.6; Mobile Phone quoted 10.8, measured
10.0). It is a quote on the routine/function METADATA surface, which v1 read
through the CLI — not a field the run returns. No recording contains it, and
v1 says plainly that "responses carry NO cost field"; an earlier draft of this
decision placed it on the routine envelope, which was asserted rather than
observed. Consequence: the derived fold is always the
settled answer and no `mismatch` key can ever appear, so the pinned rates
have no per-run cross-check — see D7a for what stands in for one.

## D9 — `search_id` is a path param; the identity is pinned brace-free

The upstream path is `/search/query-mode/{search_id}/run`. v1 took the handle
in the BODY and re-homed it onto the path inside a lifecycle hook, "for one
uniform input surface for agents". The engine now validates `pathParams` as a
first-class slot and substitutes + URI-encodes them (fundable's `/deal`
precedent), so the hook is unnecessary: `search_id` is declared where it goes
and shows up in the compiled url. `zEndpointPath` admits no braces, so the
public identity is pinned to the v1 id `/search/query-mode/run`. Cost, eyes
open: callers move one field from `body` to `pathParams`.

## D10 — Routine ids are baked into `request.path`, percent-encoded

The Clay-managed routine ids are workspace-scoped (`function:t_…`, minted
into our workspace, enumerated once via `clay routines list` — the Public API
has no listing endpoint). v1 substituted them through a path param; here each
doc bakes its own into `request.path` as `/routines/function%3At_…/run` —
percent-encoded exactly as v1's `encodeURIComponent` sent it, which is the
form the vendor is known to accept. The raw `/routines/{routine_id}/run`
surface stays unexposed: users cannot discover ids, and a raw id parameter
would make our workspace's custom functions addressable. If Clay ever
re-mints them the docs start answering 404 error-as-data — re-enumerate and
update the paths.

## D11 — v1's `notes` land in `meta.notes`; its `hints` become description prose

REVISED at the merge with `add-meta-notes` (#14), which added `meta.notes`
after this connector was first written. The original text said the schema had
no home for v1's `notes` and folded them into `meta.description`; there is one
now, and it was added for precisely this — "operational CAVEATS: what a caller
must know before calling, not what the endpoint is for". So the caveats moved
out of the prose and the split is now the schema's own:

- **`meta.notes`** — the six facts that cost a caller something if unknown:
  company-domain's fuzzy matcher (it cannot miss, so a wrong answer is
  indistinguishable from a right one and still draws); the search iterator's
  expiry-404 and what is actually metered (rows returned, not the limit
  asked); work-email's and mobile-phone's ~3-minute miss latency; and
  mobile-phone's charged miss. They MOVED — the sentences were deleted from
  the descriptions rather than duplicated.
- **`meta.description`** — capability text only: what the endpoint does, what
  it returns, and every v1 `runHint` as prose (name → domain → the three
  company functions; work-email ↔ person ↔ mobile-phone). Hints stay here:
  "call this next" is what an endpoint is FOR, not a caveat.
- **`tags`** — dropped; `["verified"]` has no consumer in v2.

Two notes are NOT copies of v1's. mobile-phone's "an empty result is not
billed" is false under D3 and now states the reduced draw with both figures.
And the enrich-person at-least-one-identifier rule is deliberately absent from
`notes`: the schema reserves notes for cross-field rules that CANNOT survive
`z.toJSONSchema`, and under D13 this one does — it rides the compiled `anyOf`,
where a caller's tooling sees it.

v1's long `summary` strings became `description`; a fresh one-line `summary`
was written for catalog rows.

## D12 — Fixtures are recorded, then sanitized

Every committed chain is a real 2026-09-16 recording, hand-minimized the way
the recorder's own docstring prescribes (the work-email run took 22 calls,
the mobile-phone miss 59; both are committed as three). The company-domain
recording behind `routine-hit` happened to settle on its FIRST poll, so its
still-running 202 tick is spliced from the work-email recording — the
RUNNING arm is exercised on a chain whose terminal call is the one we
actually got back.

Three classes of value are replaced before committing, because this repo is
public: our account's quota watermark in `period_quota`
(`used`/`remaining`/`resets_at`); the real people the search returned (names,
LinkedIn urls, employers — the recorder scrubs emails and phones by pattern,
not identities); and the vendor's run and search handles, normalized to
`RUN1` / `SEARCH1` so the shared chains bind. Every field, type and nesting
is the recording's; only identifying values are stand-ins, and each fixture's
`description` says so.

One chain is NOT a recording: `routine-failed-item` uses the shape v1's
provider tests pinned, because a failed item could not be provoked through
the public surface at port time — its description says that too.

## D13 — Enrich Person's "at least one identifier" binds as a union, not a refinement

Correcting this change's own first cut (PR #16 review). Clay declares neither
`Professional Profile URL` nor `Email` required, but a body with neither runs
a search for nobody and can draw for it — v1 guarded that with a `.refine`.
The first cut dropped the guard, reasoning from fundable's D6 ("cross-field
refinements cannot survive JSON-Schema compilation, so document them") and
adding that Clay answers 400 anyway.

Both halves were wrong. Only the REFINEMENT FORM fails to compile; a UNION
compiles to `anyOf`, which is exactly what pdl's person-search calls "the ONE
v1 cross-field rule that survives compilation". And the 400 claim was never
observed — it was read off a v1 openspec line describing v1's own LOCAL
rejection ("rejected locally, no upstream call"), not Clay's behaviour. The
guard was removed on the strength of a vendor behaviour nobody had tested;
v1's own comment says the opposite.

Probed, because the failure mode decides the design: `z.toJSONSchema` drops a
`.refine` **silently** — no throw, no warning, and the emitted schema is
byte-identical to the unrefined one. Since the engine validates the COMPILED
JSON Schema with ajv and never sees the zod object, a refined mirror would
read as guarded while enforcing nothing. That is strictly worse than no
guard. The union emits a two-arm `anyOf` with a one-key `required` per arm,
`additionalProperties: false` preserved on both, and the `.describe()`
surviving as the schema's own `description` — 941 bytes for this two-property
body, against pdl shipping the same pattern over ~10 properties per arm.

It binds at the ENDPOINT, not in the mirror — the opposite of pdl. pdl's
`query` XOR `sql` is the VENDOR's rule and belongs in the mirror; "at least
one identifier" is OURS, and D25 keeps the mirror vendor-faithful with every
tightening at the binding. Rejected alternatives: enforcing in a pure
`input.toRequest` or in `lifecycle.start` — both run at runtime, but both
report a bad caller input as `FN_CONTRACT` or a provider error instead of
`INVALID_INPUT`, and the latter pushes one endpoint's rule into the
provider-wide start the other six share.
