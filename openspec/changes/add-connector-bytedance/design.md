# Design: add-connector-bytedance

Decision record for the ByteDance (BytePlus ModelArk / Seedance) port.
v1 source: `monid-services/services/shared/providers/adaptors/bytedance/`.

## D1 — One endpoint per model; the endpoint IS the model name

Carried over from v1 unchanged. ByteDance is the PLATFORM (one credential, one
base URL, one task API); Seedance is a model family. Models differ in
CAPABILITY, not only price — 2.5 reaches 30s and mov but drops 1080p/4k — so a
single endpoint with a `model` parameter would have to accept values that its
own resolution enum cannot serve and rates that do not exist.

Folder names cannot contain dots (`zEndpointName` is `[a-z0-9-]+`), so the
directories are `seedance-2-0*` while the public identity is pinned
explicitly:

| folder | `endpoint` | id |
| --- | --- | --- |
| `seedance-2-0` | `/seedance-2.0` | `bytedance#seedance-2.0` |
| `seedance-2-0-fast` | `/seedance-2.0-fast` | `bytedance#seedance-2.0-fast` |
| `seedance-2-0-mini` | `/seedance-2.0-mini` | `bytedance#seedance-2.0-mini` |
| `seedance-2-5` | `/seedance-2.5` | `bytedance#seedance-2.5` |

Pinning is not cosmetic here: all four share `request.path`
(`/api/v3/contents/generations/tasks`), so the `?? request.path` default would
resolve all four to the same id and fail compilation on duplicate identity.

## D2 — The rate card is the VENDOR's, both price columns

BytePlus publishes two $/1M-token rates per resolution: input WITHOUT a
reference video, and input WITH one (the with-video column is LOWER — e.g. 2.0
@720p is $7.00 vs $4.30).

v1 charged the user the no-video column unconditionally and recorded the
applicable column as `actualCost`; the spread was deliberate margin
(`BYTEDANCE_MARKUP_PERCENTAGE = 0`, with a comment saying the margin "comes
from the with-video rate spread").

Here the doc declares BOTH columns, because in v2 `usage.credits` is the
VENDOR's meter, not our price. The precedent is apify, whose pool is literally
"US dollars" = what Apify charges us, with markup applied downstream by the
broker card. Modeling only one column would bake a pricing decision into an
artifact whose job is to describe the vendor.

This also satisfies the D29 completeness rule: the video tier is INPUT-GATED,
and a model omitting an input-gated line makes estimates wrong the moment that
input is used.

### Confirmed against live runs, not just the pricing page

Two real generations on `seedance-2.0-mini` (480p, 4s), recorded as the
`task-succeeded` and `task-succeeded-ref-video` fixtures:

| | tokens | vendor rate | charge |
| --- | --- | --- | --- |
| plain | 40,594 | $3.50/1M | $0.142079 |
| with a reference video | 80,770 | $2.10/1M | $0.169617 |

Two things only a live run shows. First, a reference-video request costs
roughly DOUBLE the tokens, because Ark meters the input video as well — which
is what v1's "upstream minimum-token floors" note was describing. Second, the
one-column model would have priced those 80,770 tokens at $3.50/1M = $0.282695,
a 67% overcharge against what BytePlus actually billed. Both the line AND the
count have to follow the request for the number to come out right; that pair is
pinned by a test.

## D3 — Resolution × tier as COMPOSITE lines, not a price matrix

v1 used `PER_UNIT_MATRIX` with a `resolution` selector. D19 removed matrix/
variant model kinds: "conditions/offsets/selection are COUNTING rules owned by
consolidate/estimate, never model shapes".

So the selector becomes the LINE. Each endpoint is a `COMPOSITE` whose
components are `PER_UNIT`·`TOKEN`, keyed `<resolution>` and
`<resolution>_with_video`, and the estimate/evidence fns put the whole token
count on the one line that applies. The doc remains a complete rate card —
anyone holding it re-derives the charge from evidence × rates — and the
selection logic lives where D19 says it belongs.

Consequence: every endpoint has ≥2 metered components, so the compiler requires
DOC-level `estimate` AND `evidence` on all four (a provider-level fn cannot
know which line a count belongs to). Accepted; they are per-model facts anyway.

### `every: 1`, amount = rate ÷ 1e6

The fold is `ceil(quantity / every) × consumes.amount`. With `every: 1` and an
integer token count the ceil is the identity, so the charge matches BytePlus to
the cent. A coarser block (`every: 1_000_000`, amount `7.0`) would round a
108k-token run up to a full million — a 9× overcharge. The readable-looking
option is the wrong one here.

## D4 — Rate keys come from the REQUEST, not the response echo

v1 stashed `resolution` and `hasVideoInput` into run metadata at submit,
because Ark poll bodies do not reliably echo `resolution`, and because the
`model` echo silently changed from the submitted `ep-*` handle to the dated
model name around 2026-07-20 — which broke an echo-keyed price lookup and
recorded $0 cost on every run (a fake 100% margin in dashboards) until someone
noticed.

v2 needs no stash at all: `usage.evidence` receives `data.input.body` on the
envelope ctx. The rate keys are read from the request that was actually made.
The class of bug v1 hit is structurally unreachable, and the lifecycle state
stays empty of billing signals.

The one thing that must come from the response is the QUANTITY —
`usage.completion_tokens`, the vendor's own meter.

The live recordings confirm the hazard is real and current: every poll body we
captured echoes `"model": "dreamina-seedance-2-0-mini-260615"` — the dated
model id — not the `ep-20260719074900-2b555` handle we submitted. An
echo-keyed lookup written against today's observed value would still be wrong
tomorrow. (These bodies DO echo `resolution`, which v1 found unreliable; we do
not read it either way.)

## D5 — Estimates use the vendor formula; `"auto"` holds the maximum

`tokens = width × height × 24 fps × duration / 1024`, with BytePlus's published
resolution×ratio dimension table inlined in each estimate fn. Closed terms
cannot import, so the table is duplicated per endpoint, trimmed to that model's
resolutions. This is the cost of the closed-term rule and it is worth paying:
the fn is self-contained and the doc is complete on its own.

`ratio` absent or `"adaptive"` estimates with the 16:9 dimensions — pixel
counts across ratios at one resolution differ by under 5%, and the SETTLE uses
actual tokens regardless.

`duration: "auto"` (2.5 only, our name for Ark's `-1` sentinel) defers the
length to the model, so the hold takes the worst case it may pick
(`maxDuration`, 30s). Under-holding would let a run settle past the budget that
admitted it; over-holding is released at settle. v1 records a prod bug here:
`Number("auto")` is `NaN`, which collapsed to the 5s default and under-held by
~6×. v2 has no numeric coercion in that path at all — the literal is compared
directly.

## D6 — CROSS-FIELD validation moves to `meta.notes`; single-field stays enforced

The line is narrower than "refinements don't survive", and getting it wrong
costs real enforcement — see the correction at the end of this entry.

What the engine enforces is the COMPILED JSON Schema, so the question for any
rule is whether `z.toJSONSchema` can express it:

| authoring | compiles to | enforced |
| --- | --- | --- |
| `.strict()` | `additionalProperties: false` | yes |
| `.default(n)` | `default` (materialized into the input) | yes |
| `.enum()` / `.min()` / `.max()` | `enum` / `minimum` / `maximum` | yes |
| `.regex(/…/)` | `pattern` | yes |
| `.refine()` / `.superRefine()` | *nothing — silently dropped* | **no** |

So SINGLE-field constraints belong in the schema and are enforced before the
wire. Only rules spanning two or more fields have nowhere to compile to.

v1 enforced four CROSS-field rules that therefore cannot come along: at most one
`first_frame`, `last_frame` requires a `first_frame`, per-role reference caps,
and `ratio` must be `"adaptive"` when a frame is pinned. Those move into
`meta.notes` (the slot `add-meta-notes` adds), where an agent reads them before
calling. The runtime cost is one Ark round trip: Ark rejects the combination
itself with a non-2xx, which the engine settles as zero-billed DATA. We trade a
local 400 for a free remote one.

Rejected alternative: re-implementing the checks in `lifecycle.start` and
throwing. That turns a caller error into a run FAILURE rather than an input
rejection, and puts validation logic somewhere no catalog consumer can see it.

**Correction (CodeRabbit, PR #14).** The first cut of this entry stated the rule
as "refinements do not survive" and, on that basis, `zRefUrl` shipped as
`z.string().min(1)` — accepting `data:` URLs, `http:`, and arbitrary junk while
its own describe promised a public `https://` URL. That is a single-field
constraint: it compiles to a `pattern` and is now enforced. The over-broad
reading of this rule is what produced the gap, which is why the table above
replaced the sentence.

## D7 — Poll non-2xx THROWS; submit non-2xx is DATA

Asymmetric on purpose.

A failed SUBMIT means no task exists and nothing will be billed, so the Ark
error is returned as data (`COMPLETED` with the vendor status; the engine
zero-bills every non-2xx envelope).

A failed POLL means our own GET failed while a task is very likely still
running — and BytePlus will bill us for that generation whether or not we keep
asking. Returning it as data would terminate the run, hand the caller a
provider error, and abandon a video we paid for. So it throws: infrastructure
failure, retriable, matching v1.

This diverges from apify's poll (which returns non-2xx as data). The difference
is that an abandoned Apify actor run stops costing; an abandoned Ark generation
does not.

Task-level failures are different again and DO settle: `failed` / `cancelled` /
`expired` return a synthesized 500 and `succeeded`-without-`content.video_url`
a synthesized 502, both with `providerHttpStatus: 200` (the poll exchange
itself succeeded — design D12), both zero-billed.

## D8 — `ep-*` handles are inlined in `input.toRequest`

Ark's create-task body needs a `model`. Ours is the BytePlus inference-endpoint
handle provisioned for our account (`ep-20260719072449-96psr` etc.), never
user-supplied — the endpoint IS the model, so exposing a `model` input would
let a caller point one endpoint's rate card at another model.

`input.toRequest` is the right seam: pure, runs after validation, and the same
fn does the `"auto"` → `-1` translation at the wire boundary so the published
schema never exposes a magic number. The handles compile into `catalog.json`;
they are account-scoped resource ids, inert without the API key.

Authoring note: `toRequest` sits OUTSIDE the typed layer — `defineEndpoint`
narrows `data.input.body` for estimate/evidence/output/lifecycle, but
`input.toRequest` comes through untyped from `SeedInput`, so its body is
`Json`. Spreading it does not compile. The idiom is `utils.json.merge`, which
is what exa (`omit`) and akta (queryParams rebuild) already do. Typing that
slot would be a reasonable follow-up; it is a type-only change with no effect
on the compiled doc.

## D9 — The vendor reports no credits, so consolidate only strips

Ark returns token COUNTS (`usage.completion_tokens`), never a dollar amount.
So `usage.consolidate` returns `credits: {}` — an empty claim falls back to the
derived fold, which is the only settlement path here — and its real job is the
D27 strip: `utils.json.pluck(data.output, "$.usage")` lifts the meter out of
the payload in one motion. Billing facts do not ride the user-facing output;
the count stays public in `usage.evidence`, keyed by the line it priced.

`pluck` rather than `omit` because the removal must be exactly that path, not a
deep key-walk.

## D10 — Timeouts carry v1's measured values

`requestMs: 60_000` — v1 raised this from 30s after observing SUBMIT calls
sitting on the cliff (p999 27.8s on runs that succeeded; 20 submits killed at
exactly 30s and surfaced as zero-billed 504s). The measured tail was CENSORED
at the old cap, so 60s is a first step, not a proven ceiling.

`runMs: 1_800_000` (30 min) — sized to 2.5's 30-second outputs, which run well
past 15 minutes.

`pollMs: 60_000` — v1's cadence.
