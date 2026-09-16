# Tasks: add-connector-minimax

## 1. Categories + provider

- [x] 1.1 `connectors/categories.ts`: `image-generation`,
      `video-generation`, `music-generation`, `speech`
- [x] 1.2 `provider.ts`: bearer auth, baseUrl, timeouts, ONE pool
      (`default`, US dollars) declared here, blocking `lifecycle.start`
      with the `base_resp` envelope check, `output.fromResponse` strip,
      `output.fromError` for both envelope shapes; NO consolidate
- [x] 1.3 `schema/h3-video.ts`: the H3 model registry + `makeH3VideoBody`
      factory + shared media-url / content-item fragments

## 2. Endpoints (8)

- [x] 2.1 music-generation: PER_CALL $0.15, identity from `request.path`
- [x] 2.2 image-generation: PER_UNIT·RESULT $0.0035, `n` defaulted at the
      binding, estimate = `n`, evidence = returned image count
- [x] 2.3 text-to-speech: COMPOSITE hd/turbo character lines, model routes
      the count, evidence = `extra_info.usage_characters` (absent → 0)
- [x] 2.4 video-hailuo-2-3: COMPOSITE of 3 cell lines, start/poll over the
      3-hop submit → query → files/retrieve chain
- [x] 2.5 video-h3 ×4: COMPOSITE per-resolution second lines (+ split
      input-video lines on H3-Max, + image line on H3 and H3-Fast),
      start/poll over the 2-hop submit → query chain

## 3. Fixtures + tests

- [x] 3.1 Provider-level shared chains: blocking-ok, envelope-error,
      http-error, hailuo-succeeded, hailuo-failed, h3-succeeded, h3-failed
      (all `synthetic-` prefixed — no key held)
- [x] 3.2 `lifecycle.test.ts`: the blocking relay, the envelope error
      settling 502 with zero usage, both poll chains, a failed task
      zero-billing
- [x] 3.3 Per-endpoint billing tests: music flat, image per-result, TTS
      hd-vs-turbo routing, Hailuo cell selection across all three cells, H3
      seconds + image netting, H3-Max split output/input lines
- [x] 3.4 Estimate tests through the sealed unit for every metered doc
- [x] 3.5 Live tests gated on `MINIMAX_API_KEY`

## 4. Wiring + docs

- [x] 4.1 README connector row
- [x] 4.2 Verify: fmt · lint · check · test · double-compile ·
      version:check · catalog smoke · engine:estimate per billing shape

## 5. Post-key verification

- [ ] 5.1 Replace synthetic fixtures via `deno task record` when
      `MINIMAX_API_KEY` exists; run `test:live`
- [ ] 5.2 Confirm H3-Max accepts reference roles (the public page says
      T2V/I2V only — design D8) and that its input-video seconds bill at
      the split rate
- [ ] 5.3 Confirm `task.usage.input_image_count` is still the RAW
      submitted count (v1 live-verified 2026-08-16) — the netting in
      `evidence` assumes it
