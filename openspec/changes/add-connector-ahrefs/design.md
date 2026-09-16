# Design: add-connector-ahrefs

Only the choices the port was FORCED to make. Everything not listed follows
the precedents in `.claude/commands/provider-port.md` (sync GET → akta,
sync POST → exa).

## D1 — The vendor formula `max(50, units × rows)` as two lines; the minimum is charged

Ahrefs bills every request in API units: `units_per_row × rows`, floored at
50 per request (empty results included). v1 billed the caller per ROW and
absorbed the 50-unit floor on the platform side (`billAtPublishedRate`,
"requests under ceil(21.5 / U) rows run at a loss by design").

A `max()` is not a model shape. Two options were live:

1. **Two PER_UNIT lines (chosen).** `rows` (unit RESULT, `amount` = the
   endpoint's units per row) and `minimum_top_up` (unit CREDIT, `amount`
   1). `evidence` puts `rows` on the first and `max(0, 50 − units × rows)`
   on the second, so the fold is exactly the vendor's charge, and the
   agent reads both facts off the card: "10 units per row" and "topped up
   to a 50-unit request minimum". Selection is a counting rule (D19).
2. One `rows` line and absorb the floor (v1 parity). Rejected: the doc is
   the vendor's rate card, not a pricing policy (clay D3 — mobile-phone's
   charged miss). Whether the caller pays the floor is the broker's call,
   made with the fact in hand; a doc that hides it settles less than the
   vendor took on every small request.

Consequence, eyes open: an empty 2xx now settles 50 units where v1 settled
0. It is the vendor's charge.

## D2 — No `usage.consolidate`; the cost headers are a follow-up

No Ahrefs response BODY carries a meter, so there is no vendor claim and
the derived fold is the bill — the 36 authored units-per-row constants
have no runtime cross-check, and the tests hold them as literals (clay
D7a: a `{id → units}` table, asserted to cover exactly the catalog).

Ahrefs does answer with `x-api-units-cost-*` response headers (v1 used
`x-api-units-cost-row` / `-total-actual` in drills only). Reading one as
the claim would give every run a `usage.mismatch.derived` guard on the
constants — but headers reach only lifecycle fns (engine 0.2.0), so all
36 docs would become `lifecycle.start` docs stashing the header into
`state.data` for a provider consolidate; the exact header names could not
be confirmed without a key (the public docs pages 404); and v1 never read
them. Deferred to tasks.md, to be done with a key in hand.

Update 2026-09-16: the docs are reachable at
https://docs.ahrefs.com/en/api/docs/limits-consumption and name the
headers (`x-api-rows`, `x-api-units-cost-row`, `x-api-units-cost-total`,
`x-api-units-cost-total-actual`, `x-api-cache`); the same page states the
rule (`max(base_cost, per_row_cost * num_rows)`, base 50, 1 unit per
field, expensive fields marked in each endpoint's field description), and
all 36 authored constants were re-derived from it (PR #20 / #21 review).
The rest of D2 stands — the header read is still the follow-up.

## D3 — One generic rows counter, stated on every endpoint

Every doc has TWO metered lines, so the compiler requires each doc to own
its `estimate` and `evidence` — a provider-level counter (akta's shape)
cannot be inherited. The counter is therefore stated VERBATIM on all 36
endpoints and interns to ONE fnTable entry: the first array value in the
body is the rows (`{ backlinks: [...] }`, `{ metrics: [...] }`), an object
body counts one row (`{ metrics: {...} }`, `{ domain_rating: {...} }`),
and the per-row rate is read off the doc's own model
(`data.usage.model.components.rows.consumes.amount`) — the same
model-driven posture as akta's provider evidence, so the constant lives in
one place per doc.

Estimates read the rate the same way and differ only in where the row
promise comes from: the required `limit` (18 docs), a fixed 1 (6 snapshots),
250 countries (metrics-by-country — deduced from the vendor, about 230
countries carry data), `keywords.length`, `top_positions`,
`targets.length`, or date buckets (D6). Eight shapes, each interned across
its family.

## D4 — Fixed field sets, and the guard that survives compilation

The vendor prices a row by the UNIQUE fields across `select` / `where` /
`order_by`. Each endpoint injects its fixed `select` in `input.toRequest`
(callers never supply it) and its units-per-row constant is the sum of
those fields' costs from the vendor OpenAPI annotations (v1's
`UNITS_PER_ROW`, drill-verified against `x-api-units-cost-row`).

v1 restricted `where` / `order_by` to that set with `.superRefine` — which
compiles to nothing. Both become JSON Schema `pattern`s:

- `order_by`: `^T(,T)*$` with `T = (f1|f2|…)(:(asc|desc))?` (one token
  only where the vendor parses a comma list as a single field name —
  crawled-pages; a narrower sortable set where the vendor 400s on a
  selectable field — `title_target`, `http_code_target`).
- `where` (a JSON filter string): must be a JSON object, and a negative
  lookahead rejects any `"field": "<name>"` whose name is outside the set
  — `^(?![\s\S]*"field"\s*:\s*"(?!(?:f1|f2)")[^"]*")\s*\{[\s\S]*\}\s*$`.
  Coarser than v1's tree walk (it does not parse JSON) but it fails
  closed on the one thing that matters: a field that would raise the
  per-row cost never reaches the wire.

Both are enforced by ajv before any spend, and the tests pin an
out-of-set field on each.

## D5 — Row budgets REQUIRED; scope knobs default

`limit` (1–100, the plan cap) and `top_positions` are the estimate's
whole basis, so they are REQUIRED at the binding (D25) — v1 defaulted them
to 100, which is also the vendor's cap; the vendor's own default is 1,000
rows, ten times the plan cap. `mode` (subdomains), `protocol` (both) and
`history_grouping` (monthly) carry the vendor's documented defaults at the
binding so the wire always states the scope, as v1's always-serialized
defaults did. Batch Analysis applies `mode` / `protocol` per target —
upstream 400s on a target without both.

## D6 — History buckets without a clock

History rows are date buckets between `date_from` and `date_to`. v1
defaulted `date_to` to today and clamped the hold at 60 buckets via a
`.superRefine`. Hook fns have no `Date` (not in the closed-term
whitelist) — so `date_to` is REQUIRED at every history binding, and the
estimate counts with pure arithmetic over the two YYYY-MM-DD strings.

What it counts (live-measured 2026-09-16 on the vendor's free targets,
Monid-dev runs; CodeRabbit on PR #20 flagged the first draft's
`ceil(days / 30)`): a row is a bucket ANCHOR inside the range —
daily rows carry every day (01-31→02-01 = 2 rows), weekly rows are dated
on Mondays (Sun 01-05→Mon 01-06 = 1 row, dated 01-06), monthly rows on
the 1st (01-31→02-01 = 1 row, dated 02-01). So the estimate counts the
anchors in `[date_from, date_to]`: days, Mondays (from a known Monday on
the days-from-civil scale), or 1sts (month index arithmetic). v1's
`ceil(days / 30)` under-held a 1st-to-1st span in a short month
(02-01→03-01 = 2 rows, ceil(29 / 30) = 1); the reviewer's "inclusive
calendar months" would over-hold 01-31→02-01 (2 vs 1). The settle trues
up to the rows returned either way.

The 60-bucket cap is not enforceable without a refine; it rides
`meta.notes`, and the estimate promises the whole range rather than
clamping — a clamp would under-hold.

## D7 — The vendor body relays verbatim; no `{type, rows}` envelope

v1 normalized every 2xx to `{ type: label, rows | data }` for its row
counter. v2 counts in `evidence` off the raw body (D3) and relays the
vendor's own shape — `{ backlinks: [...] }` — because that is what the
doc says the endpoint returns, and nothing billing-related rides the body
to strip. Hosted consumers expecting v1's envelope change shape; flagged.

## D8 — Synthetic fixtures, engine-issued URLs

No Ahrefs key is held. Bodies follow the v1 adaptor tests; each fixture's
URL was produced by running the doc through the engine with a stub fetch,
so `select` injection, the keyword join and the binding defaults are
recorded exactly as issued. Every file is `synthetic-` prefixed and says
so. Live tests are written and gated on `AHREFS_API_KEY`; each live run
draws at least 50 units.

## D9 — Provider-level hooks: `fromError` only

Ahrefs errors are real non-2xx `{ error: string }` bodies (v1 drills) —
digested, raw kept. `request.headers: { Accept: application/json }`
mirrors v1. Timeouts 30 s / 60 s from `endpointExecution/config.yml`.
Categories `seo` / `geo` added to `categories.ts` with the manifest's
own names and descriptions; `ai-responses-count` alone is `geo`.
