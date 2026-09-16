import { z } from "zod";

/**
 * MiniMax Text-to-Speech (`POST /v1/t2a_v2`) request body — the faithful
 * vendor mirror (design D25: optionality only; defaults at the binding).
 *
 * WHY THE SYNC ENDPOINT: MiniMax ships two T2A HTTP APIs. The sync one
 * has the strictly richer request surface — `timbre_weights` voice mixing,
 * subtitle controls, `output_format` — and needs no poll loop or
 * files/retrieve hop. The async one buys only a longer text ceiling, and
 * its file-input mode is unusable for Monid callers anyway
 * (`text_file_id` names a file uploaded under OUR API key). The WebSocket
 * surface is out of scope.
 *
 * OUTPUT SHAPE IS FIXED: `stream` and `output_format` each admit a single
 * value. `output_format: "hex"` would inline the entire audio as hex —
 * roughly 20MB for a 10,000-character run — into the run record; "url"
 * keeps a compact JSON body with a 24h CDN link, matching every other
 * MiniMax endpoint. Streaming-only knobs (`stream_options`, `force_cbr`,
 * `subtitle_type: "word_streaming"`) are omitted as unreachable.
 *
 * v1's cross-field rules lived in a `superRefine`; refinements do not
 * survive `z.toJSONSchema`, so they are stated in the field descriptions
 * and MiniMax answers a violation as error-as-data.
 */

/**
 * The models Monid publishes — ONLY those MiniMax publishes a rate for.
 * `speech-01-hd` / `speech-01-turbo` are upstream-valid but carry NO
 * published price; accepting them would mean either an unpriced line or a
 * guessed rate, so the enum stays narrower than the vendor's.
 *
 * The split IS the rate card: hd bills $100/M characters, turbo $60/M.
 * The endpoint's COMPOSITE model has one line per tier and the fns route
 * the character count by which list the selected model falls in.
 */
export const MINIMAX_HD_MODELS = [
    "speech-2.8-hd",
    "speech-2.6-hd",
    "speech-02-hd",
] as const;
export const MINIMAX_TURBO_MODELS = [
    "speech-2.8-turbo",
    "speech-2.6-turbo",
    "speech-02-turbo",
] as const;
export const MINIMAX_T2A_MODELS = [
    ...MINIMAX_HD_MODELS,
    ...MINIMAX_TURBO_MODELS,
] as const;

/** Upper bound on `text` — the upstream sync-endpoint ceiling. */
export const MAX_T2A_CHARS = 10000;

/**
 * The default speech model — ALSO the pricing selector fallback. ONE
 * constant on purpose (design D5): validation and the estimate must
 * resolve the SAME model, or a body omitting `model` would hold one rate
 * ($60/M turbo) and settle another ($100/M hd). Pinned by a test.
 */
export const DEFAULT_T2A_MODEL = "speech-2.8-turbo";

const zVoiceSetting = z
    .strictObject({
        voice_id: z
            .string()
            .min(1)
            .describe(
                "Target voice id. Omit ONLY when mixing voices via " +
                    "timbre_weights. System, cloned and AI-designed voices " +
                    "are all accepted (e.g. English_Graceful_Lady, " +
                    "Japanese_Whisper_Belle).",
            )
            .optional(),
        speed: z
            .number()
            .min(0.5)
            .max(2)
            .describe("Speech rate, 0.5-2. Default 1.")
            .optional(),
        vol: z
            .number()
            .gt(0)
            .max(10)
            .describe("Volume, greater than 0 and at most 10. Default 1.")
            .optional(),
        pitch: z
            .number()
            .int()
            .min(-12)
            .max(12)
            .describe("Pitch shift, -12 to 12. Default 0 (original).")
            .optional(),
        emotion: z
            .enum([
                "happy",
                "sad",
                "angry",
                "fearful",
                "disgusted",
                "surprised",
                "calm",
                "fluent",
                "whisper",
            ])
            .describe(
                "Emotion. Omit to let the model pick from the text. " +
                    "'fluent' and 'whisper' are available ONLY on the " +
                    "speech-2.6 models.",
            )
            .optional(),
        text_normalization: z
            .boolean()
            .describe(
                "Normalize numbers and symbols before reading (better digit " +
                    "handling, slightly higher latency). Default false.",
            )
            .optional(),
        latex_read: z
            .boolean()
            .describe(
                "Read LaTeX formulas wrapped in $$. Chinese only; forces " +
                    "language_boost to Chinese. Default false.",
            )
            .optional(),
    })
    .describe("Voice selection and delivery controls.")
    .optional();

const zTimbreWeights = z
    .array(
        z.strictObject({
            voice_id: z.string().min(1).describe("A voice to blend."),
            weight: z
                .number()
                .int()
                .min(1)
                .max(100)
                .describe("Relative weight, 1-100. Higher is more similar."),
        }),
    )
    .min(1)
    .max(4)
    .describe(
        "Blend up to 4 voices. Mutually exclusive with " +
            "voice_setting.voice_id — provide one or the other.",
    )
    .optional();

const zAudioSetting = z
    .strictObject({
        sample_rate: z
            .union([
                z.literal(8000),
                z.literal(16000),
                z.literal(22050),
                z.literal(24000),
                z.literal(32000),
                z.literal(44100),
            ])
            .describe("Sampling rate. Default 32000.")
            .optional(),
        bitrate: z
            .union([
                z.literal(32000),
                z.literal(64000),
                z.literal(128000),
                z.literal(256000),
            ])
            .describe("Bitrate. Default 128000.")
            .optional(),
        format: z
            .enum(["mp3", "wav", "flac", "pcm"])
            .describe(
                "Audio container. Default mp3. voice_modify applies only " +
                    "to mp3, wav and flac.",
            )
            .optional(),
        channel: z
            .union([z.literal(1), z.literal(2)])
            .describe("1 = mono (default), 2 = stereo.")
            .optional(),
    })
    .describe("Audio output configuration.")
    .optional();

const zPronunciationDict = z
    .strictObject({
        tone: z
            .array(z.string().min(1))
            .describe(
                "Pronunciation overrides, each 'word/(replacement)' — e.g. " +
                    "'处理/(chu3)(li3)' or 'omg/oh my god'.",
            )
            .optional(),
    })
    .describe("Custom pronunciation dictionary.")
    .optional();

const zVoiceModify = z
    .strictObject({
        pitch: z.number().int().min(-100).max(100).describe(
            "Pitch adjustment, -100 to 100.",
        ).optional(),
        intensity: z.number().int().min(-100).max(100).describe(
            "Intensity adjustment, -100 to 100.",
        ).optional(),
        timbre: z.number().int().min(-100).max(100).describe(
            "Timbre adjustment, -100 to 100.",
        ).optional(),
        sound_effects: z
            .enum([
                "spacious_echo",
                "auditorium_echo",
                "lofi_telephone",
                "robotic",
            ])
            .describe("Post-processing sound effect.")
            .optional(),
    })
    .describe(
        "Voice post-processing. Applies only when audio_setting.format is " +
            "mp3, wav or flac.",
    )
    .optional();

export const zTextToSpeechBody = z.strictObject({
    model: z
        .enum(MINIMAX_T2A_MODELS)
        .describe(
            "Speech model. The '-hd' models bill $100 per million " +
                "characters and the '-turbo' models $60 per million — the " +
                "tier you pick IS the rate. Defaults to " +
                DEFAULT_T2A_MODEL + ".",
        )
        .optional(),
    text: z
        .string()
        .min(1)
        .max(MAX_T2A_CHARS)
        .describe(
            `Text to synthesize (max ${MAX_T2A_CHARS} characters). Use <#x#> ` +
                "between characters to insert a pause of x seconds " +
                "(0.01-99.99). Charged on MiniMax's own billed character " +
                "count, reported back as extra_info.usage_characters.",
        ),
    voice_setting: zVoiceSetting,
    timbre_weights: zTimbreWeights,
    audio_setting: zAudioSetting,
    pronunciation_dict: zPronunciationDict,
    voice_modify: zVoiceModify,
    language_boost: z
        .string()
        .min(1)
        .describe(
            "Bias recognition toward a language or dialect (e.g. 'English', " +
                "'Chinese', 'Japanese', 'auto').",
        )
        .optional(),
    subtitle_enable: z
        .boolean()
        .describe(
            "Return a subtitle file URL alongside the audio. Default false.",
        )
        .optional(),
    output_format: z
        .literal("url")
        .describe(
            "Audio is always returned as a CDN URL (the link EXPIRES after " +
                "24h). Fixed — 'hex' would inline the whole audio payload.",
        )
        .optional(),
    stream: z
        .literal(false)
        .describe("Streaming is not supported; always false. Fixed.")
        .optional(),
});
