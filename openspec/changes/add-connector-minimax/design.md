# Design: add-connector-minimax

Decision record for the minimax port (v1 `adaptors/minimax`, 8 defs). Only
the choices the declarative model forced are recorded; everything else
mirrors v1 verbatim.

## D1 — Identities are the vendor's native paths, verbatim

Three of MiniMax's eight native paths are snake_case
(`/v1/music_generation`, `/v1/image_generation`, `/v1/t2a_v2`), which
looked at first like it needed a contract change. It does not:
`zEndpointPath`'s character class `[a-z0-9._~-]` is `.`, `_`, `~`, `-` —
it already admits `_`, and the catalog already ships underscored ids
(`apify#delicious_zebu/…`, `apify#tri_angle/…`). So all eight ids stand as
the vendor writes them, and no schema, compiler or engine change is
needed. Rejected before the regex was read properly: a mechanical `_` →
`-` rename, which would have cost monid-services a mapping table and
broken the id trail back to v1 for nothing.

Consequence: the three sync endpoints omit `endpoint` entirely, so their
identity falls out of `request.path` (the repo's default posture). The
five video endpoints pin `endpoint` explicitly, because their wire paths
are transport plumbing — `/v1/video_generation` and `/v2/video_generation`
carry five model-named identities between them, and the four H3 endpoints
share ONE wire path, so without the pin they would collide on the derived
id.

## D2 — One pool, US dollars, declared on the provider

MiniMax meters a single pay-as-you-go dollar balance: every published rate
is a dollar amount and no response body carries a cost, credit or token
receipt. So the pool is `default` ("US dollars"), declared ONCE on the
provider per pdl D6, and all eight endpoints' `consumes.credit` name it —
the provider pool is drained and each compiled doc narrows to `{default}`.

**Why not MiniMax's own token or credit unit** (asked on PR #15, answered
here so the next reader does not have to re-derive it):

- **Tokens cannot work.** A pool is only usable if every line can state its
  rate as a quantity of that pool per unit counted. MiniMax publishes
  per-token prices ONLY for the LLM models (M3 $0.30/M in, $1.20/M out;
  M2.7 the same), and this connector wraps none of them. For media the
  published card is per second, per character, per image, or per video, and
  four of the five families report no token figure at all (music, image and
  Hailuo report none; TTS reports characters). H3 is the near-miss — it
  returns `task.usage.total_tokens` — but there is no published price per
  token for it and its card says "Billed per second", so the number is
  provider-internal accounting, which is why `output.fromResponse` strips
  it. With no conversion available, the only way to express $0.038 per 480P
  second in tokens would be to mint a pool PER RATE (`480p_second`,
  `768p_second`, …) — the line list wearing a different hat, and useless
  for the one thing a pool is for: knowing whether the account has enough
  left.
- **MiniMax "Credits" are the wrong balance.** They are real and convert
  linearly (1,000 credits = $1), so no fan-out would occur — but they are a
  SUBSCRIPTION-KEY product. Monid authenticates with a standard Open
  Platform API key, which draws the pay-as-you-go account balance in
  dollars and never touches Credits. Naming a balance we do not debit, for
  a unit defined as exactly dollars × 1000, would add indirection carrying
  no information.

The general rule this settles: **the pool is whatever the vendor actually
debits for the key we hold.** akta/octen/fundable/ploid/pdl meter our
account in their own credits, so those are their pools; exa, apify and
MiniMax debit dollars, so theirs is dollars.

No `usage.consolidate`. The vendor reports QUANTITIES
(`extra_info.usage_characters`, `task.usage.*_seconds`) but never a
consumed-credits number, and a quantities reading is `evidence`, not a
claim. Consequence, eyes open: without a claim there is no per-run
`usage.mismatch.derived` cross-check for MiniMax — the pinned rates are
guarded only by `test:live` and manual re-audit. MiniMax publishes no
machine-readable pricing surface, so no `scripts/drift/` suite is added.

The v1 `MINIMAX_MARKUP_PERCENTAGE = 0` seam does not cross over: markup is
a hosted concern and the doc carries the vendor's own rates.

## D3 — The envelope check needs `lifecycle.start`, at provider level

MiniMax answers auth (1004), balance (1008), moderation (1026) and
validation (2013) failures with **HTTP 200** and
`base_resp.status_code != 0`. v1 converted those to a synthesized 502
inside `makeBlockingStart` so the handler's `isProviderError` check set
`chargeUser: false`.

In this engine a DECLARATIVE endpoint cannot do that. The sync path is
`buildRequest → transport.execute → settle(response.status, …)` and the
billing gate is `!(httpStatus >= 200 && httpStatus < 300)` computed from
the transport status alone; `output.fromResponse` returns `Json` with no
status channel and runs AFTER zero-usage forcing, by design ("a projection
can never touch a bill"). The ONLY status-synthesis capability is
`zLifecycleCompleted{httpStatus, providerHttpStatus}` — which is exactly
the hook v1 used. So the mechanism ports unchanged; nothing new is needed.

It matters most for music: a LEAF PER_CALL model has its flat 1 appended
by the ENGINE on any 2xx, so an auth failure would bill $0.15. Image and
TTS would settle 0 naturally (their meters read empty results), but a
"successful" run carrying an error envelope is wrong regardless, and v1's
behaviour is the contract monid-services already expects.

Placed on the PROVIDER, so the three blocking endpoints inherit one fn.
Consequence stated plainly: `resolve()` has no opt-out, so EVERY minimax
doc becomes a lifecycle doc. That is correct here — all eight need it
(three for the envelope check, five for task polling). `poll` is NOT
provider-level: that would make music, image and TTS pollable.

**ONLY `status_code: 0` is success** (tightened on PR #15 review). v1 read
`statusCode !== undefined && statusCode !== 0`, which classifies a 200
carrying NO `base_resp` as a success. `utils.json.optionalNum` returns
`undefined` only when the path is absent (a present non-number throws), so
that arm means "malformed envelope" — and letting it through reaches the
billing gate, where the engine appends music's flat `CALL: 1` and charges
$0.15 for a failure. The check is now `statusCode !== 0` in both places
that read the envelope (the provider relay and Hailuo's `start`). This is a
DELIBERATE divergence from v1: a legitimate 200 omitting `base_resp` would
now fail the run, but MiniMax documents `base_resp` on every `/v1`
response, and the failure mode is loud and zero-billed rather than a silent
charge.

**The V2 surface needs none of this** — `/v2` answers with real HTTP
statuses and an OpenAI-style error body, so the four H3 `start` fns carry
no envelope check at all.

## D4 — Hailuo is a per-CELL composite; H3 is per-resolution-per-second

The two video families are priced differently by the vendor, so they model
differently.

Hailuo-2.3 is published per VIDEO, in three cells: 768P/6s $0.28,
768P/10s $0.56, 1080P/6s $0.49. Those are not linear in duration
($0.0467/s at 6s vs $0.056/s at 10s), so no per-second line can reproduce
the card. Modeled as a COMPOSITE of three PER_UNIT·RESULT lines
(`768p_6s`, `768p_10s`, `1080p_6s`), with estimate and evidence both
placing `1` on the cell the request selects — the D19 rule that selection
is a COUNTING rule owned by the fns, never a model shape. MiniMax returns
no usage block for V1 video, so the REQUEST is the settlement basis; v1's
`videoActualCost` did the same. A failed task settles 500 and is
zero-billed before evidence runs.

The H3 family is published per SECOND per resolution, so each model is a
COMPOSITE of one PER_UNIT·SECOND line per resolution it serves. Where the
reference-video input rate EQUALS the output rate (H3, H3-Fast) one line
covers both and the basis is `task.usage.total_seconds` — v1's reading.
Where they differ (H3-Max) the lines split, and the bases are
`output_seconds` and `input_seconds` separately. The per-image line exists
only on the models that bill images (H3, H3-Fast: first 5 free, then
$0.04); H3-Max and H3-Max-Turbo do not bill images at all, so they carry
no image line.

Every one of these composites has ≥ 2 components, so each doc carries its
own `estimate` and `evidence` — which the compiler requires of any
≥2-metered model anyway.

## D5 — TTS model selection is a counting rule over two lines

MiniMax prices T2A by model tier: $100/M characters for the `*-hd` models,
$60/M for `*-turbo`. A LEAF PER_UNIT carries one rate, so the endpoint is
a COMPOSITE of `hd_character` and `turbo_character`, both PER_UNIT·CHARACTER,
and the fns route the character count to whichever line the selected
`model` names. Same D19 move as Hailuo's cell selection. Rejected:
splitting into two endpoints, which would fracture one vendor endpoint
across two public identities.

Rates are per-CHARACTER ($0.0001 and $0.00006) with `every: 1`, NOT $100
with `every: 1_000_000`. `every` is a BLOCK rate — the fold is
`ceil(quantity / every) × amount` — so a million-character block would
round a 500-character run up to a full block and bill $100 for it.

The binding default `speech-2.8-turbo` IS the pricing selector fallback.
One constant, pinned by a test: if validation and the estimate resolved
different models, a body omitting `model` would hold one rate and settle
another.

## D6 — v1 refinements documented, not pretended

`.refine`/`.superRefine` are dropped by `z.toJSONSchema` with no error, so
every v1 cross-field rule moves into `.describe()` prose and MiniMax
answers the violation as error-as-data. Two v1 schemas additionally had to
be restructured, because their encoding depended on machinery that does
not survive compilation:

- **image**: v1 used `z.preprocess` (to fill `model` before a
  discriminated union could read its discriminator) over a
  `z.discriminatedUnion`. The preprocess FUNCTION never runs here — input
  mode resolves the pipe to its target schema — and a `.default()` under a
  transform is deleted from the doc outright. Rebuilt as one flat
  `.strict()` object; `model` optional in the mirror,
  `.default("image-01")` at the binding; the model↔field rules
  (`width`/`height` are image-01 only; `image-01-live` requires
  `subject_reference`) become describes. Bonus: `.strict()` DOES survive as
  `additionalProperties: false`, which retires v1's provider-layer
  `INTERSECTION_ALLOWED_KEYS` allowlist entirely.
- **hailuo-2.3**: v1 used `zCommon.and(zMode).and(zResDur)` — an
  intersection whose `anyOf` arms encoded "prompt or first_frame_image"
  and "1080P ⇒ 6s". That compiles to an `allOf` of `anyOf`s that, with
  per-block `additionalProperties`, is not usefully checkable, and the
  estimate needs a flat typed read of `resolution`/`duration` anyway.
  Rebuilt as a flat `.strict()` object with both knobs defaulted at the
  binding (768P / 6s — the vendor's own defaults), rules in describes.

Music and H3 keep their object shape; only their `superRefine` bodies move
into prose.

**But a REGEX is not a refinement** (corrected on PR #15 review). The
reasoning above is right about `.refine`/`.superRefine` and wrong if
generalized: `z.string().regex(...)` compiles straight through to a JSON
Schema `pattern`, which the engine validates before any request leaves. So
rules expressible as a pattern should BE a pattern, not prose. The media
URL rule is now enforced:

```ts
z.string().min(1).regex(/^https?:\/\//, "must be a public http(s) URL")
```

on all three media-URL fields — H3's `zMediaUrl` (image / video / audio
items), Hailuo's `first_frame_image`, and image's
`subject_reference[].image_file`.

**Public http(s) links only — a deliberate narrowing from v1.** v1
documented two accepted forms on these fields ("Public URL or base64 data
URL") and rejected only `mm_file://`. We accept ONE:

- `mm_file://{file_id}` names a file uploaded to MiniMax under MONID's key,
  so a caller cannot produce a valid one and a guessed one would read our
  storage. v1 rejected it too — we now actually enforce it.
- `data:` URIs are newly rejected. They inline the whole asset into the
  request body and the run record, against MiniMax's own 64MB body cap and
  a 30MB image limit. Same reasoning that pins TTS to `output_format:
  "url"` rather than letting a caller inline ~20MB of hex.

A caller previously sending inline base64 now gets INVALID_INPUT before any
wire call. Pinned by tests asserting the compiled `pattern` and rejecting
`mm_file://`, `MM_FILE://`, `data:` and `ftp://`.

## D7 — Image netting moves from the poll into `evidence`

v1 stamped `task.usage.billable_input_images = max(0, input_image_count −
free)` onto the payload during `poll`, because its TIERED price card could
only read a field that existed. Here `usage.evidence` computes the netting
directly from the raw `input_image_count` that already rides the output —
one fn, no payload mutation, and the raw count stays visible to the caller
so the arithmetic is checkable. `stampBillableImages` is not ported.

## D7a — Hailuo polls on an unrecognized status, it does not settle

v1's Hailuo poll handled `Preparing`/`Queueing`/`Processing` → running and
`Fail` → error, then fell through to the Success path for everything else
(`endpoints/video-common.ts:294`). A 200 carrying a status we do not know,
or none at all, therefore reached file resolution, found no `file_id`, and
ended the run with a synthesized 502 — a permanent failure for a task still
in flight. v1's own H3 poll guarded this; its Hailuo poll did not.

Hailuo now matches the H3 shape: anything that is not `Success` and not a
known terminal failure returns `RUNNING`, bounded by `runMs` (600 s). A fix
of a latent v1 gap rather than a porting slip.

## D8 — Rate provenance

Every pinned amount, with its source. Four H3 rows are NOT on the public
pricing page; they are carried from v1's production-verified table and
confirmed directly with MiniMax (owner rule, 2026-09-16).

| line | rate | source |
| --- | --- | --- |
| music per song | $0.15 | published (marked Discontinued; existing paying users keep access) |
| image per image | $0.0035 | published, `image-01` |
| TTS hd / turbo | $100 / $60 per M characters | published, incl. the 2.6 and 02 legacy rows |
| Hailuo 768P 6s / 10s, 1080P 6s | $0.28 / $0.56 / $0.49 | published under Legacy Models |
| H3 768P / 2K per second | $0.08 / $0.13 | published |
| H3 480P per second | $0.038 | NOT published — from MiniMax 2026-09-08, accepted live 2026-09-07 |
| H3 input image beyond 5 | $0.04 | published |
| H3-Max 480P / 768P output | $0.05 / $0.08 | published |
| H3-Max input video 480P / 768P | $0.0553 / $0.143 | NOT published — confirmed with MiniMax |
| H3-Max-Turbo 480P / 768P | $0.025 / $0.04 | NOT published — confirmed with MiniMax |
| H3-Fast 480P | $0.046 | NOT published — confirmed with MiniMax |

One published note is deliberately NOT followed: the page says H3-Max
"currently supports T2V and I2V only" and that its input images are not
billed. v1 models H3-Max with reference support and split input-video
rates, confirmed with MiniMax; the images-not-billed half IS followed (no
image line on H3-Max). Task 3.3 verifies reference support against a real
call.

## D9 — Line ids are minted, snake_case

Per pdl D28: ids are OURS, minted from the vendor's own vocabulary by one
transform, never copied verbatim, and the deleted `vendor` field is not
used. MiniMax publishes no line names at all — its card is a table of
(model, resolution, duration) cells — so the ids are minted from the
coordinates that select them: `768p_6s`, `1080p_6s`, `480p_second`,
`768p_output_second`, `480p_input_video_second`, `input_image`,
`hd_character`, `turbo_character`. Lowercased, `_`-joined, resolution
first — so a billing surface sorts them into a readable card without a
lookup table.
