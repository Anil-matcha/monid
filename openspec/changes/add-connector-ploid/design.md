# Design: add-connector-ploid

Decision record for the ploid port (v1 `adaptors/ploid`, 10 defs). Only
the choices the declarative model forced are recorded.

## D1 — `/v1/agent` owns its lifecycle; the other nine stay declarative

Ploid has exactly one async operation. Declaring `lifecycle.start/poll`
on the provider would turn nine synchronous docs into lifecycle docs for
no reason, so the agent doc declares its own start / poll / state (the
hunterio email-verifier posture; owner 2026-09-15). `start` relays the
compiled request, parks RUNNING on a 2xx whose `data.status` is
queued/running (stashing `data.poll_url` in typed state), completes a 2xx
top-level `error` under its `http_status` (400–599, else 502) over
providerHttpStatus 200 (D12 of add-async-run-protocol), and relays every
other answer as data. `poll` GETs the stashed path (falling back to
`/v1/agent/runs/{id}`) with the same terminal mapping; queued/running
returns RUNNING with no state (carry-forward, D21). No `stop`: the vendor
documents no cancel operation.

## D2 — The pool is ACU; the agent knob is the vendor's `max_acu`

Ploid's one denomination is the ACU (`acu_value_usd` const 0.1). v1
multiplied every meter reading by `PLOID_USD_PER_ACU`; the pool rule
(2026-09-15) keeps the vendor's unit — pool "Ploid ACU", every
`consumes.amount` in ACU: search blocks 0.1, socials 1, enrich 1 / 1 /
10, agent 1 per ACU, LinkedIn reads 0.06 ACU (the settled partnership
rate — USD 0.006 at USD 0.10/ACU; the meter reports the same 0.06 ACU,
never a dollar figure). For the same reason
the agent exposes the vendor's integer `max_acu` (1–64, default 2)
instead of v1's `max_spend_usd` dollar ceiling that a custom start
converted (owner 2026-09-15, option a). Both meter fields are ACU, so ONE
provider consolidate plucks `meta.credits_charged` and `meta.acu_used`
and claims whichever is present.

## D3 — Enrich: no stamps, counts read off the raw body

v1 owned a custom start whose only job was to write `profile_units` /
`email_units` / `phone_units` onto the body so its TIERED output
selectors could read them. In v2 the evidence fn reads the raw response
directly — a component counts 1 when its `data.*` field is present and
non-null — so no start and no stamp. The personal-email fallback (3 ACU)
is indistinguishable in the response; the `email` line carries the work
rate (1) and the vendor's `meta.acu_used` claim settles the difference
(`usage.mismatch.derived` on such a run is expected and correct). v1
pre-held email at 3 ACU; a v2 estimate promises quantities, not money, so
it promises 1 per requested component.

## D4 — Block billing is `every: 10`, not a derived count

v1 computed `ceil(results / 10)` in code and billed "blocks". The v2 model
says it directly: PER_UNIT·RESULT with `every: 10` and 0.1 ACU — the fold
ceils, the evidence counts delivered rows, and the estimate promises the
required `num_results` / `limit` (D25: the primary limit knob is required
even though the vendor defaults it to 25).

## D5 — The provider consolidate carries v1's `meta` strip

Besides the meter, v1 stripped `request_id`, `session_id`, and the
balance fields from `meta` and dropped an emptied `meta`. `session_id` is
the shared-workspace agent handle — all tenants share one Ploid
workspace, so it must never reach a buyer; the balances are account
internals. They ride the same one-motion consolidate (the fundable
precedent for non-meter balance fields). `warning` (partial results on
`search_timeout`), `cursor` and `message` stay.

## D6 — Recorded 401s, synthetic successes

No `PLOID_API_KEY` is held. Every endpoint's `provider-error` fixture is
a real 401 recorded with an invalid key: it pins the vendor's error
envelope (`{error: {code, message, request_id}}`) and captures each wire
body — the agent's pinned fields and defaulted `max_acu`, enrich's
defaulted `enrichments`. Success chains are `synthetic-`, shaped from the
v1 adaptor tests (drill 2026-09-05). Unverified against real traffic;
replace via `deno task record`.
