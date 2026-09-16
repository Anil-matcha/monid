# Design: add-connector-suzanne

Decision record for the Suzanne port (v1 `adaptors/suzanne`, 4 defs) and the one
engine capability it forced. Everything not recorded here mirrors v1 verbatim.

## D1 — Response headers are DATA (engine ABI, 0.1.0 → 0.2.0)

`GET /v1/models/{job_id}/download` answers `302 Found` with an empty body and
`Location: <presigned S3 url>`. The answer is the envelope, not the letter.

The engine's transport already sets `redirect: "manual"` — deliberately: following
a redirect would stream the mesh binary through the engine AND risk re-sending the
provider credential to a foreign origin (design D16's concern, one layer down).
But `TransportResponse` was `{status, body, contentType}`: the header was dropped
before `sniffDecode`, so a lifecycle fn saw `{status: 302, body: null}` and the URL
was simply gone. No connector-level workaround exists — it is a hole in the port,
not in the connector.

So the port carries them:

- `TransportResponse.headers?: Record<string, string>` — OPTIONAL, so
  `relayTransport` and any host transport stay source-compatible; absent ⇒ `{}`.
- `HttpResult.headers: Record<string, string>` — REQUIRED at the fn boundary
  (`shared/core/schema/hooks/lifecycle.ts`, a CONTRACT_PATH): a fn never has to
  branch on presence.
- Keys are LOWERCASED. `Object.fromEntries(Headers)` already does this per the
  Fetch spec; stating it makes `res.headers.location` a contract, not a guess.

Scope, deliberately narrow: these are the VENDOR'S RESPONSE headers. Our request
headers — where credentials live — remain invisible to fns, unchanged. Nothing
about auth custody moves.

Rejected: letting the doc opt into `redirect: "follow"`. It would hand fns a
multi-megabyte binary body through `sniffDecode` (which would stringify it),
blow the doc size and state caps, and re-send the Authorization header to S3 —
the exact failure D16 exists to prevent.

Rejected: a dedicated `location` field on `HttpResult`. One vendor's 302 is not
a reason to grow a single-purpose slot; `Content-Range`, `Retry-After` and
`Link` pagination are the same shape of fact. "Response headers are data" is the
general form and costs the same bump.

## D2 — Fixture response headers are ALLOWLISTED

Fixtures have never recorded headers, for one reason: credentials must not leak
into committed files. That rule is about REQUEST headers, and it stands. Response
headers are a different set — but `set-cookie` is a response header too, and so
are account-identifying ratelimit and tracing headers.

So the recorder captures an explicit allowlist, `RECORDED_RES_HEADERS =
["location"]`, and no other header is kept. Growing the list is a deliberate
edit in the same PR as the connector that needs it — the categories.ts posture.
The allowlist is enforced by `zRecordedCall`, not merely by the recorder: a
fixture is a file, and a hand-edited one carrying `set-cookie` must fail to
LOAD rather than replay.

**The allowlist alone is not enough (review finding, PR #13).** An earlier
draft of this entry claimed fixtures stay "credential-free by construction"
once the list is bounded. That was wrong, and wrong about precisely the header
the list exists to carry: a `location` pointing at a presigned URL IS a bearer
credential — the authorization rides the query string. Recording one verbatim
would commit temporary read access to the vendor's object, in a repo whose
fixtures are public.

Nothing leaked — the committed chain is synthetic and no key has ever worked
here — but task 5.2 is "record the real chains when a key arrives", so the
tripwire was armed for whoever does that. So `scrubCalls` now runs
`scrubUrlCredentials` over recorded header values: every query VALUE collapses
to `REDACTED`, while scheme, host, path and parameter NAMES survive. Shape is
what a fixture is for; the signature is not part of the shape.

Value-level, not a denylist of known-secret parameter names (`X-Amz-Signature`,
`Signature`, `token`, …): a denylist is wrong the first time a vendor signs
with a parameter nobody thought to list. Replay-safe because matching reads
request method + URL only, never response headers — and assertions that care
read `searchParams.has(...)`, which a value redaction leaves intact.

Implementation note worth its own line: `recordingFetch` rebuilds the `Response`
it relays (with `content-type` only). Without re-attaching the allowlisted
headers there, `record` mode would capture a `location` into the fixture while
the live run that produced it saw none — the fixture would pass and the recording
run would fail. Both sides carry them (the LIVE side keeps the real value; only
what is written to disk is scrubbed).

## D3 — Lifecycle placement for a MIXED-mode provider

Apify is uniformly async: one provider-level lifecycle, every endpoint pure data.
Suzanne is two async generations plus two sync utilities, and `resolve()` only
FALLS BACK — a provider-level `lifecycle.start` reaches every endpoint and there
is no opt-out leaf. Three options were live:

1. Provider-level GENERIC start ("2xx with a `job_id` ⇒ park, else complete").
   Rejected: it silently discards v1's contract check. A generation submit
   answering 2xx WITHOUT a job id would settle as a success and bill $0.65 for
   nothing.
2. Author identical start/poll inline on both generation endpoints; the
   compiler's normalization + interning collapses them to one fnTable entry
   each. Correct, but duplicates ~45 lines of authored source for an identical
   artifact.
3. **Chosen.** The PROVIDER states the default and the ENDPOINT overrides only
   what diverges — the D27 subclassing rule, applied to lifecycle:
   - provider `start` = the generation submit, STRICT (2xx without `job_id`
     throws — Suzanne contract violation, v1 parity);
   - provider `poll` = `GET /v1/jobs/{job_id}`, shared by both generations;
   - `uploads` and `model-download` override `start` with their own sync fns.

Consequence, eyes open: the two sync docs also resolve the provider's `poll` and
therefore carry `timeouts.pollMs`. It is inert — their `start` always returns
COMPLETED, so poll is never invoked — and the compiler is satisfied (it rejects
poll WITHOUT start, which is not the case here). One unused fn ref beats a
weakened contract check on a paid endpoint.

No `lifecycle.state` schema is declared: the only fact threaded between ticks is
`externalRunId`, which is an engine-owned field of `zFnState`, not the `data`
bag. Apify needs the bag because its pricing signals ride the run record rather
than the dataset; Suzanne's meter rides the job body the poll already returns.

## D4 — Failed jobs are 500-as-data, and Suzanne refunds them

`poll` maps `failed | cancelled` to `COMPLETED {httpStatus: 500,
providerHttpStatus: 200}` carrying the job's own `{code, message}` — the
ours/theirs pair (design D12): the poll EXCHANGE succeeded (200), the JOB failed
(our synthesized 500). The engine zero-bills every non-2xx envelope, which lines
up exactly with the vendor: the docs state a `vendor_model_error` is refunded,
and a cancellation that lands in time is refunded too. Nobody pays twice for the
same truth.

## D5 — Public identity for the download endpoint

`zEndpointPath` admits no braces and the compiler derives identity from
`request.path` when `endpoint` is absent, so `/v1/models/{job_id}/download`
cannot be its own id. Pinned to `/v1/models/download` (id
`suzanne#v1/models/download`) — the fundable D1 precedent. The wire path keeps
its placeholder; `substituteUrl` fills it from `pathParams`.

## D6 — The mirror is the CURRENT vendor surface, not v1

The v1 adaptor is stale. Ported against the live docs (2026-09-15):

| Fact | v1 adaptor | Live docs |
| --- | --- | --- |
| `params.faces` | 40000/100000/500000/1500000, default 100000 | 200000/500000/1000000/2000000, default 500000 |
| `params.quad` | absent | bool, default false (caps 150k faces, delivered FBX) |
| `params.texture_quality` | absent | `standard` \| `detailed` |
| `outputs` | glb/obj/stl | glb/obj/stl/**fbx** |
| `atelier` inputs | single photo only, `pbr` forced true | text prompt OR single photo |
| `capture` | reserved | public (4 views) — still omitted, non-goal |
| cancel | "no cancel endpoint" | `POST /v1/jobs/{job_id}/cancel` exists |

Per design D25 the mirror carries optionality ONLY — no `.default()`, no
tightening. Suzanne needs no binding tightening for billing reasons (every model
is flat or FREE, so there is no estimate to keep exact); the only binding
derivation is D7's.

Also dropped from v1 and deliberately not replaced: the multi-photo
"silently clamped to ≤20k faces" note (the live docs describe clamping generally,
"values that don't apply to a given path are clamped to the closest supported
value") and `atelier`'s `pbr: z.literal(true)` (the docs now document `pbr` as a
normal default-true knob on every model).

## D7 — `images_inline` is mirrored, then disabled at the binding

The vendor documents two image channels, "pick exactly one". The mirror carries
both — anything else would be inventing a vendor that does not exist. The
binding then derives the surface Monid actually offers:

```ts
zPhotoTo3dBody
    .omit({ images_inline: true })        // upload-only (see below)
    .required({ images_upload_ids: true }) // the remaining channel is mandatory
    .strict()                              // inline is REJECTED, not forwarded
```

Why upload-only: the run input is persisted verbatim into the upstream run record
(a 400 KB DynamoDB item); a ≤5 MB base64 photo fails run creation. `.strict()`
turns that into a clear validation issue at the boundary instead of a confusing
downstream failure.

Modeled as a FLAT object, NOT v1's `z.preprocess` + `discriminatedUnion`: that
combination is not reliably JSON-Schema representable (the compiler would reject
it with SCHEMA_INVALID), and `.omit()` — the thing that expresses "we do not
offer this channel" in one derivation — does not exist on a union. The
per-model constraints the union encoded (atelier takes a single front view) live
in the field descriptions and are enforced server-side, exactly as design D4 of
the fundable port handled `refineExactlyOne`.

## D8 — Flat rate card in dollars; the claim, if any, is `billable_amount_cents`

Suzanne prices per call, in dollars, with no public rate sheet ("pricing is set
per account"). So the pool IS dollars — the apify posture — with v1's contract
rates pinned per line: $0.65 text-to-3d, $0.65 photo-to-3d, $0.01 uploads, FREE
download. Every model is PER_CALL or FREE, so the compiler synthesizes
`estimate` and `evidence` (`core#usage.synthesizedEmpty`) and this connector
authors NO quantities fns at all. v1's `extractResultCount` is gone with them:
`outputs[].length` never moved the bill.

v1's 50% markup and the $0.80 user-facing `price` are not ported — pools are the
vendor's own units and the rate card is the broker's job.

The vendor's own meter is `billable_amount_cents`, documented on the `202` submit
response (always `0` there, before any work). The `GET /v1/jobs/{job_id}` response
the docs publish does NOT carry it, and the recording run that would have settled
the question could not run (D11). So this port ships WITHOUT a
`usage.consolidate` — it is optional (D27), and the pinned fold IS the bill.

That is the conservative choice, not a gap papered over: authoring a consolidate
against an unverified field would either read nothing (identical behavior, dead
code) or read a field whose units we guessed. When a working key exists, task 5.1
inspects a terminal job row; if `billable_amount_cents` is there, consolidate
becomes a three-line fn (`$.billable_amount_cents ÷ 100`, entry OMITTED when
absent) and the pinned rates become a live per-run cross-check via
`usage.mismatch.derived`.

## D9 — Timeouts

Provider default is the SYNC budget (request 30 s, run 60 s) with `pollMs` 10 s
(the docs ask for 5–10 s). The two generation endpoints override `runMs` to
600 s. The docs give 30 s–2 min single-image, 1–4 min multi-view, and a 20-min
practical ceiling; v1 shipped 360 s. Ten minutes keeps real margin over the
documented worst case while staying well under the vendor's own give-up line —
a run timeout on a job we have already PAID for is the expensive failure mode.

## D11 — Synthetic fixtures: the key on hand is rejected

The plan was to record real chains. The key supplied (`sk_test_…`) is rejected by
the vendor, and the API distinguishes the two failures cleanly, so this is not a
routing or header mistake:

| Request | Answer |
| --- | --- |
| no `Authorization` header | `401 {"message":"Unauthorized"}` |
| `Authorization: Bearer <supplied key>` | `403 {"message":"Forbidden"}` |
| `Authorization: Bearer totally-wrong` | `403 {"message":"Forbidden"}` |

The supplied key behaves exactly like a garbage key. Its prefix is also wrong for
this vendor: the docs show `sznn_test_…` throughout, and 403 is the API Gateway
authorizer rejecting the token before any route runs.

So fixtures are SYNTHESIZED from the published response shapes — every field in
them comes from a documented example (the submit 202, the job row, the upload
201, the nested error envelope, the 302) — and carry the `synthetic-` prefix that
says so. They are unverified against real traffic, and the second wave's D8 is on
the record about what synthetics have missed before (trailing-slash 307s,
undocumented envelopes). Replace via `deno task record` when a working key
arrives; the live suite is written and gated, not stubbed.

## D10 — v1's `notes` land in `meta.notes`; `hints` stay prose

v1 carried `hints` (cross-endpoint pointers) and `notes` (the uploads
`Content-Type` / S3 `403 SignatureDoesNotMatch` trap).

AMENDED (rebase onto `main`). When this entry was first written neither had a v2
slot, so the upload caveat went into the uploads endpoint's `meta.description` —
the field agents actually read — and a reviewer then flagged it as missing
because they checked the PROVIDER's description first.

`add-meta-notes` (#14) has since landed `meta.notes`: "operational CAVEATS —
what a caller must know before calling, not what the endpoint is for". That is
precisely this fact, so the caveat moves into its proper slot and v1's `notes`
are restored rather than approximated — the `Content-Type` trap, the per-client
suppression recipes, and the expiry windows, as three standalone entries.
`description` keeps what the endpoint IS for.

It stays on the uploads ENDPOINT, not the provider: provider notes CONCATENATE
onto every endpoint (the additive resolution of add-meta-notes D1), and three of
the four never touch an upload URL.

The cross-endpoint pointers have no slot and stay prose in `description`, on the
endpoints that need them ("call the uploads endpoint first", "fetch the mesh
with the model-download endpoint") — those are wayfinding, not caveats.
