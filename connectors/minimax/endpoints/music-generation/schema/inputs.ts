import { z } from "zod";

/**
 * MiniMax text-to-music request body — the faithful vendor mirror (design
 * D25: optionality only, no `.default()`; the vendor's documented defaults
 * are applied at the binding in endpoint.ts).
 *
 * ONE endpoint with `model` as an input selector: the two exposed models
 * share the exact request shape, rules and $0.15 price, so they do not
 * warrant separate endpoints. The `-free` variants (RPM 3 on a shared
 * platform key) and `music-cover` (a different input surface with no
 * published rate) are deliberately not exposed.
 *
 * Output shape is FIXED: `output_format` and `stream` each admit a single
 * value, so a caller cannot switch the run into a shape the pipeline
 * cannot carry. MiniMax always returns a 24h-expiring CDN URL from a
 * single blocking (non-stream) POST.
 *
 * v1 enforced the lyrics-vs-instrumental rule in a `superRefine`.
 * Refinements do not survive `z.toJSONSchema`, so it is stated in the
 * field descriptions instead and MiniMax answers a violation as
 * error-as-data.
 */

const zAudioSetting = z
    .strictObject({
        sample_rate: z
            .union([
                z.literal(16000),
                z.literal(24000),
                z.literal(32000),
                z.literal(44100),
            ])
            .describe("Sampling rate.")
            .optional(),
        bitrate: z
            .union([
                z.literal(32000),
                z.literal(64000),
                z.literal(128000),
                z.literal(256000),
            ])
            .describe("Bitrate.")
            .optional(),
        format: z.enum(["mp3", "wav", "pcm"]).describe("Audio format.")
            .optional(),
    })
    .describe("Audio output configuration.")
    .optional();

/** The exposed music models — both $0.15 per song (published rate). */
export const MINIMAX_MUSIC_MODELS = ["music-3.0", "music-2.6"] as const;

export const zMusicGenerationBody = z.strictObject({
    model: z
        .enum(MINIMAX_MUSIC_MODELS)
        .describe(
            "Music model. music-3.0 is MiniMax's current recommended " +
                "generation; music-2.6 is the previous one. Same $0.15 " +
                "price per song. Defaults to music-3.0.",
        )
        .optional(),
    prompt: z
        .string()
        .max(2000)
        .describe(
            "Description of the music's style, mood, and scenario. REQUIRED " +
                "when is_instrumental is true.",
        )
        .optional(),
    lyrics: z
        .string()
        .min(1)
        .max(3500)
        .describe(
            "Song lyrics, using \\n to separate lines. Supports structure " +
                "tags: [Intro], [Verse], [Pre Chorus], [Chorus], [Bridge], " +
                "[Outro], [Solo], etc. REQUIRED unless is_instrumental or " +
                "lyrics_optimizer is true.",
        )
        .optional(),
    is_instrumental: z
        .boolean()
        .describe(
            "Generate instrumental music (no vocals). When true, prompt is " +
                "required. Defaults to false.",
        )
        .optional(),
    lyrics_optimizer: z
        .boolean()
        .describe(
            "Auto-generate lyrics from the prompt when lyrics is empty. " +
                "Defaults to false.",
        )
        .optional(),
    output_format: z
        .literal("url")
        .describe(
            "Audio is always returned as a CDN URL (the link EXPIRES after " +
                "24h). Fixed — no other value is accepted.",
        )
        .optional(),
    stream: z
        .literal(false)
        .describe("Streaming is not supported; always false. Fixed.")
        .optional(),
    audio_setting: zAudioSetting,
});
