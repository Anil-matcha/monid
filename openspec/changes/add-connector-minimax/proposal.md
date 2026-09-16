# Proposal: add-connector-minimax

## Why

MiniMax is a live v1 monid-services provider — eight AI media-generation
endpoints (music, image, text-to-speech, and five video models) behind one
Bearer-auth API at `api.minimax.io`. It is the first media-generation
connector in this repo and the first port where every endpoint runs through
the lifecycle protocol: three complete inside a single blocking POST, five
submit a task and poll it. Everything it needs already exists: the lifecycle
hook family
carries the async protocol, the D26 billing algebra carries every rate, and
the identity vocabulary already admits the snake_case native paths. No
engine or schema change.

## What Changes

- **connectors/minimax** — 8 endpoints, `presets.auth.bearer()`, baseUrl
  `https://api.minimax.io`, ONE credit pool (`default`, US dollars)
  declared on the provider and drained by every endpoint:
  - `POST /v1/music_generation`: PER_CALL, $0.15 per song.
  - `POST /v1/image_generation`: PER_UNIT·RESULT, $0.0035 per generated
    image; `n` defaults to 1 at the binding and is the estimate.
  - `POST /v1/t2a_v2`: COMPOSITE of two metered lines — `hd_character`
    ($0.0001/char) and `turbo_character` ($0.00006/char); the selected
    `model` routes the count to one line (design D5).
  - `POST /v1/video_generation` (`/v1/video/minimax-hailuo-2.3`):
    COMPOSITE of three per-CELL lines — MiniMax prices Hailuo per video,
    not per second, and 768P is non-linear across duration (design D4).
  - `POST /v2/video_generation` × 4 (`/v1/video/minimax-h3`, `-h3-max`,
    `-h3-max-turbo`, `-h3-fast`): COMPOSITE of per-resolution
    PER_UNIT·SECOND lines, plus split input-video lines where the input
    rate differs from the output rate, plus a per-image line where images
    are billed.
- **Every endpoint is a lifecycle doc.** A provider-level
  `lifecycle.start` performs the blocking relay and converts MiniMax's
  HTTP-200-with-`base_resp.status_code != 0` envelope errors into a
  synthesized 502, so the engine zero-bills them (design D3). The five
  video endpoints override `start` and add `poll`.
- **No `usage.consolidate`**: no MiniMax response body carries a cost or
  credit field; the derived fold settles.
- **No contract change** (design D1): `zEndpointPath` already admits `_`,
  so the three snake_case native paths stand as their own identities with
  no `endpoint` pin and no rename.
- Four new category leaves (`image-generation`, `video-generation`,
  `music-generation`, `speech`), named to match the monid-services taxonomy
  manifest.
- Synthetic fixtures (`synthetic-` prefix) — no `MINIMAX_API_KEY` is held
  in this repo.

## Capabilities

- `minimax-connector`.

## Non-goals

MiniMax sells surface v1 never wrapped, recorded here so the gap is
visible rather than forgotten: Speech-to-Text ($0.38/hour), Voice Design
($3/voice), Rapid Voice Cloning ($1.5/voice), T2A Async,
MiniMax-H3-Regeneration (768P→2K, $0.05/s), MiniMax-H3-Context-IR, the
`web_search` server tool, API-vlm, and the MiniMax-M* chat models. Each is
its own change.

Also not ported, deliberately, from v1: the `music-cover` endpoint (a
different input surface with no published rate) and the `-free` model
variants (RPM 3 on a shared platform key).

## Impact

New connector tree + README row + four category leaves. No schema, no
compiler and no engine change: `ENGINE_VERSION` is unchanged, no new
`Unit`, no new preset, no new hook, and every existing doc compiles
byte-identically.
