# minimax-connector (delta)

## ADDED Requirements

### Requirement: MiniMax provider definition with one pool and a blocking start
The minimax provider SHALL declare name `minimax`, `request.baseUrl`
`https://api.minimax.io`, auth `presets.auth.bearer()`, timeouts 30 s
request / 240 s run, and a provider-level `usage.credits` declaring the ONE
pool the account meters (`default`, "US dollars") — drained by every
endpoint, so each compiled doc narrows to `{default}`. It SHALL declare NO
`usage.consolidate`: no MiniMax response body carries a cost or credit
figure, so the derived fold settles. It SHALL declare a provider-level
`lifecycle.start` that relays the compiled request and returns
`COMPLETED{httpStatus: 502, providerHttpStatus: 200}` when a 200 response
carries `base_resp.status_code != 0`, a provider-level
`output.fromResponse` that strips the provider-internal envelope and token
counters, and a provider-level `output.fromError` normalizing both the
V1 `base_resp` and V2 OpenAI-style error shapes.

#### Scenario: Envelope error is zero-billed
- **WHEN** `minimax#v1/music_generation` receives HTTP 200 with `base_resp.status_code: 1008`
- **THEN** the run settles `httpStatus: 502`, `isProviderError: true`, `usage` `{credits: {}, evidence: {}}` — the flat $0.15 is never appended

#### Scenario: Billing bases survive presentation
- **WHEN** any successful run is projected by `output.fromResponse`
- **THEN** `base_resp`, `trace_id`, `analysis_info` and the token counters are gone, while `extra_info.usage_characters` and every `task.usage` seconds/image field remain

### Requirement: Eight endpoints, five billing shapes
The connector SHALL provide 8 endpoints: `POST /v1/music_generation`
(PER_CALL, $0.15); `POST /v1/image_generation` (PER_UNIT·RESULT, $0.0035,
`n` defaulted 1 at the binding and equal to the estimate); `POST
/v1/t2a_v2` (COMPOSITE `hd_character` $0.0001 / `turbo_character`
$0.00006 per CHARACTER, `every` 1); `/v1/video/minimax-hailuo-2.3`
(COMPOSITE of three PER_UNIT·RESULT cells — `768p_6s` $0.28, `768p_10s`
$0.56, `1080p_6s` $0.49); and four H3 models
(`/v1/video/minimax-h3`, `-h3-max`, `-h3-max-turbo`, `-h3-fast`), each a
COMPOSITE of PER_UNIT·SECOND lines keyed by resolution, with split
input-video lines only where the input rate differs from the output rate
and a `input_image` line only where images are billed. The three sync
identities SHALL fall out of `request.path`; the five video identities
SHALL be pinned, since four H3 endpoints share one wire path.

#### Scenario: TTS routes the count by model
- **WHEN** `POST /v1/t2a_v2` runs with `model: "speech-2.8-hd"` and settles `extra_info.usage_characters: 1200`
- **THEN** usage is `{credits: {default: 0.12}, evidence: {hd_character: 1200}}` — `turbo_character` is absent, not zero

#### Scenario: TTS model default is the pricing selector
- **WHEN** a body omits `model`
- **THEN** validation and the estimate both resolve `speech-2.8-turbo`, so the hold and the settle use the same rate

#### Scenario: Hailuo bills the selected cell
- **WHEN** `/v1/video/minimax-hailuo-2.3` runs with `resolution: "768P", duration: 10`
- **THEN** usage is `{credits: {default: 0.56}, evidence: {768p_10s: 1}}` — the other two cells carry no count

#### Scenario: H3 bills seconds plus netted images
- **WHEN** `/v1/video/minimax-h3` runs at 768P and settles `task.usage.total_seconds: 6, input_image_count: 7`
- **THEN** usage is `{credits: {default: 0.56}, evidence: {768p_second: 6, input_image: 2}}` — the first 5 images are free

#### Scenario: Image bills only what came back
- **WHEN** `POST /v1/image_generation` requests `n: 4` and moderation blocks one
- **THEN** the estimate held 4 results but the settle bills 3 — the returned array is the whole rule

### Requirement: Async run protocol over both MiniMax task APIs
Every endpoint SHALL be a lifecycle doc. The five video endpoints SHALL
override `lifecycle.start` and add `lifecycle.poll`, with no `stop` (no
usable upstream cancel). Hailuo SHALL poll
`GET /v1/query/video_generation?task_id=` and, on `Success`, resolve the
`file_id` through `GET /v1/files/retrieve` before completing. The H3
models SHALL poll `GET /v2/query/video_generation/{task_id}`. A terminal
non-success task status SHALL settle a synthesized 500 with
`providerHttpStatus: 200`, and an unrecognized status on a 2xx SHALL keep
polling, bounded by `runMs`.

#### Scenario: Hailuo resolves the download URL before completing
- **WHEN** the task query returns `status: "Success"` with a `file_id`
- **THEN** the poll fetches `/v1/files/retrieve` and completes 200 with `{task_id, file_id, download_url, video_width, video_height, filename, bytes}`

#### Scenario: A failed task bills nothing
- **WHEN** an H3 task query returns `task.status: "failed"`
- **THEN** the run settles `httpStatus: 500`, `providerHttpStatus: 200`, `usage` `{credits: {}, evidence: {}}`

#### Scenario: Only pollable docs carry a cadence
- **WHEN** the catalog is compiled
- **THEN** the five video docs carry `timeouts.pollMs`, and the three blocking docs carry none
