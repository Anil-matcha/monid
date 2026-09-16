import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zMusicGenerationBody } from "./schema/inputs.ts";

/**
 * MiniMax Music — `POST /v1/music_generation`, one blocking call.
 *
 * Flat per-song billing, so the model is a LEAF PER_CALL and BOTH
 * quantities fns are compiler-synthesized (`{counts: {}}` is the only
 * lawful return for a meterless model). The engine appends the flat 1
 * under the reserved `CALL` key on any 2xx — which is precisely why the
 * provider's `lifecycle.start` must synthesize a 502 for MiniMax's
 * HTTP-200 envelope errors: without it, an auth or balance failure would
 * bill $0.15.
 *
 * Identity falls out of `request.path` — no `endpoint` pin needed, since
 * `zEndpointPath` admits `_` (design D1).
 */
export default defineEndpoint({
    meta: {
        displayName: "MiniMax Music",
        summary: "Compose a full song — vocals or instrumental — from a " +
            "prompt or your own lyrics.",
        description: "Compose a complete song of up to 5 minutes from a " +
            "natural-language description of style, mood and scenario, " +
            "with your own lyrics or lyrics the model writes for you. Set " +
            "'lyrics' for a vocal track (use \\n between lines and " +
            "structure tags like [Verse], [Chorus], [Bridge] to steer the " +
            "arrangement), or set 'is_instrumental' with a 'prompt' for an " +
            "instrumental, or set 'lyrics_optimizer' to have the model " +
            "write lyrics from the prompt. 'model' selects music-3.0 " +
            "(current) or music-2.6 (previous) — same capability surface " +
            "and same price. 'audio_setting' controls sample rate, bitrate " +
            "and format (mp3/wav/pcm). Returns a CDN URL that EXPIRES " +
            "after 24 hours — download it promptly. Charged $0.15 per " +
            "song regardless of model or length.",
        docsUrl:
            "https://platform.minimax.io/docs/api-reference/music-generation",
        categories: ["music-generation"],
    },
    request: { method: "POST", path: "/v1/music_generation" },
    input: {
        schema: {
            // vendor-documented API defaults, applied at the binding
            // (D25: the mirror carries optionality only). The two fixed
            // output knobs are defaulted here too, so a caller never has
            // to state the only value they may hold.
            body: zMusicGenerationBody.extend({
                model: zMusicGenerationBody.shape.model.unwrap()
                    .default("music-3.0"),
                is_instrumental: zMusicGenerationBody.shape.is_instrumental
                    .unwrap().default(false),
                lyrics_optimizer: zMusicGenerationBody.shape.lyrics_optimizer
                    .unwrap().default(false),
                output_format: zMusicGenerationBody.shape.output_format
                    .unwrap().default("url"),
                stream: zMusicGenerationBody.shape.stream.unwrap()
                    .default(false),
            }),
        },
    },
    // v1: requestTimeoutMs 600_000 / runTimeoutMs 660_000 — composition is
    // the slowest of the three blocking endpoints.
    timeouts: { requestMs: 600_000, runMs: 660_000 },
    usage: {
        /** $0.15 per song — the SAME published rate for every exposed
         *  model, independent of length (up to the 5-minute ceiling). */
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "song",
            description: "one generated song, up to 5 minutes",
            consumes: { credit: "default", amount: 0.15 },
        },
        // estimate + evidence: compiler-synthesized (meterless model).
    },
});
