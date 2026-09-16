import { defineProvider, presets } from "@shared/core";

/**
 * MiniMax (minimax.io) — AI media generation: music, images, speech, and
 * five video models. One Bearer-auth JSON API at `https://api.minimax.io`,
 * ported 1:1 from monid-services `adaptors/minimax`.
 *
 * EVERY endpoint is a LIFECYCLE doc, for one reason: MiniMax answers auth
 * (1004), balance (1008), moderation (1026) and validation (2013) failures
 * with **HTTP 200** plus `base_resp.status_code != 0`. A declarative doc
 * cannot turn that into a non-2xx — the sync path settles on the transport
 * status alone and `output.fromResponse` has no status channel (it runs
 * after zero-usage forcing, by design) — so an envelope error would bill a
 * flat model in full. v1 solved it inside `makeBlockingStart` by
 * synthesizing a 502; the same mechanism lives here as `lifecycle.start`,
 * declared ONCE at provider level and inherited by the three blocking
 * endpoints (music, image, text-to-speech). The five video endpoints
 * override `start` and add `poll` — `poll` is deliberately NOT provider
 * level, which would make the blocking three pollable.
 *
 * NO `usage.consolidate` (design D2): MiniMax reports QUANTITIES
 * (`extra_info.usage_characters`, `task.usage.*_seconds`) but never a
 * consumed-credits or cost figure, and a quantities reading is `evidence`,
 * not a vendor claim. So the derived fold IS the bill, and — eyes open —
 * there is no per-run `usage.mismatch.derived` cross-check for MiniMax;
 * the pinned rates are guarded by test:live and manual re-audit only.
 */
export default defineProvider({
    name: "minimax",
    meta: {
        displayName: "MiniMax",
        summary:
            "AI media generation — video, images, speech, and music from text.",
        description: "AI media generation from MiniMax: compose full songs " +
            "from a prompt or lyrics, generate images from text or a " +
            "reference portrait, turn text into lifelike speech across " +
            "hundreds of voices, and create video from a prompt, a " +
            "first/last frame image, or reference footage — the H3 family " +
            "(H3 up to 2K, H3-Max, H3-Max-Turbo, H3-Fast) plus Hailuo-2.3. " +
            "Video runs are asynchronous: a request submits a task and the " +
            "run polls it to completion, typically seconds to several " +
            "minutes depending on model, resolution and duration.",
        homepageUrl: "https://www.minimax.io",
        docsUrl: "https://platform.minimax.io/docs/api-reference/api-overview",
        categories: [
            "video-generation",
            "image-generation",
            "speech",
            "music-generation",
        ],
    },
    auth: { inject: presets.auth.bearer() },
    request: { baseUrl: "https://api.minimax.io" },
    // mirrors services/workflows/endpointExecution/config.yml (minimax):
    // request 30s; the 240s run default covers the blocking endpoints, and
    // each video endpoint states its own longer window + poll cadence.
    timeouts: { requestMs: 30_000, runMs: 240_000 },
    usage: {
        /** THE credit system (design D26/D2): MiniMax meters ONE
         *  pay-as-you-go balance and publishes every rate in dollars, so
         *  the pool IS dollars. Declared once here (the pdl D6 shape) and
         *  drained by all eight endpoints, so each compiled doc narrows to
         *  `{default}`. MiniMax's prepaid "Credits" balance is a different
         *  KEY TYPE (Subscription Key), not a second pool for ours. */
        credits: { default: { label: "US dollars" } },
        // No `consolidate`: nothing in any MiniMax response body is a
        // consumed-credits claim (design D2).
    },
    lifecycle: {
        /**
         * The BLOCKING relay (v1 `makeBlockingStart`) — music, image and
         * text-to-speech inherit it verbatim; the video endpoints override.
         * Three outcomes, all COMPLETED:
         *   - vendor non-2xx      → relayed as data (engine zero-bills)
         *   - 200 + envelope error → SYNTHESIZED 502 (engine zero-bills;
         *     `providerHttpStatus` records that their exchange was a 200)
         *   - 200 + clean envelope → relayed verbatim
         */
        start: async ({ utils, logger }) => {
            const res = await utils.request();
            if (res.status < 200 || res.status >= 300) {
                logger.warn("minimax non-2xx — returning as data", {
                    status: res.status,
                });
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            // HTTP 200 carrying MiniMax's own envelope. ONLY `0` is
            // success — an absent or unreadable `base_resp` is a malformed
            // 200, not a good one, and must not reach the billing gate.
            // v1 was permissive here (`!== undefined && !== 0`); we are
            // not, because the engine appends a flat PER_CALL 1 on any 2xx
            // and music would be charged for a failure (design D3).
            const statusCode = utils.json.optionalNum(
                res.body,
                "$.base_resp.status_code",
            );
            if (statusCode !== 0) {
                logger.warn("minimax envelope error — synthesizing 502", {
                    statusCode: statusCode ?? null,
                });
                return {
                    kind: "COMPLETED",
                    // OURS synthesized (the REQUEST failed) / THEIRS was a
                    // 200 (the exchange itself succeeded) — design D12
                    httpStatus: 502,
                    providerHttpStatus: res.status,
                    output: res.body,
                };
            }
            return {
                kind: "COMPLETED",
                httpStatus: 200,
                output: res.body,
            };
        },
    },
    output: {
        /**
         * Presentation only — runs AFTER usage.evidence, which reads the
         * RAW envelope, so a strip can never change a bill.
         *
         * `utils.json.omit` is DEEP: the token counters live under
         * `task.usage` (H3) and the character counters under `extra_info`
         * (TTS), so one call reaches all of them. v1's image `metadata`
         * strip is NOT carried over — the key is too generic to deep-omit
         * safely, and it is harmless noise.
         *
         * DELIBERATELY KEPT — these are the bases users are billed on and
         * must be able to check: `extra_info.usage_characters`,
         * `task.usage.total_seconds` / `output_seconds` / `input_seconds` /
         * `input_image_count`.
         */
        fromResponse: ({ data, utils }) =>
            utils.json.omit(data.output, [
                // transport envelope
                "base_resp",
                "trace_id",
                "analysis_info",
                // TTS billing-side counters (usage_characters is KEPT)
                "word_count",
                "invisible_character_ratio",
                "audio_size",
                // H3 provider-internal token accounting
                "total_tokens",
                "prompt_tokens",
                "completion_tokens",
            ]),
        /**
         * THE error-digestion hook (design D12) — runs ONLY on provider
         * errors, after zero-usage forcing. MiniMax speaks two error
         * shapes and this normalizes both while keeping the raw body:
         *   - V1 envelope: `{base_resp: {status_code, status_msg}}` (the
         *     502 our start synthesizes, and the /v1 surfaces generally)
         *   - V2 OpenAI-style: `{type, error, request_id}` with a real
         *     HTTP status (the /v2 H3 surface)
         */
        fromError: ({ data, utils }) => {
            const envelopeMsg = utils.json.optionalGet(
                data.output,
                "$.base_resp.status_msg",
            );
            const envelopeCode = utils.json.optionalNum(
                data.output,
                "$.base_resp.status_code",
            );
            const v2Error = utils.json.optionalGet(data.output, "$.error");
            const flat = utils.json.optionalGet(data.output, "$.message");
            const message =
                typeof envelopeMsg === "string" && envelopeMsg !== ""
                    ? envelopeMsg
                    : typeof v2Error === "string" && v2Error !== ""
                    ? v2Error
                    : typeof flat === "string" && flat !== ""
                    ? flat
                    : "MiniMax API error";
            const type = utils.json.optionalGet(data.output, "$.type");
            return {
                message,
                ...(envelopeCode !== undefined ? { code: envelopeCode } : {}),
                ...(typeof type === "string" ? { type } : {}),
                raw: data.output,
            };
        },
    },
});
