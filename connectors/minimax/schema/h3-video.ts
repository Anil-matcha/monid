import { z } from "zod";

/**
 * Shared H3-family fragments — the four H3 endpoints differ only in which
 * model string they pin, which resolutions they serve, how short a clip
 * they accept, and whether they take reference media. Everything else (the
 * multimodal `content` array, the media-URL rules, the ratio vocabulary) is
 * identical, so it lives here rather than being copied four times.
 *
 * This is SCHEMA machinery only. Rates are literals on each endpoint's
 * `usage.model`, and fn bodies are closed terms that cannot import — every
 * constant an estimate/evidence fn needs is written inline at its site.
 *
 * WHAT DOES NOT SURVIVE COMPILATION: v1 enforced the whole cardinality
 * rulebook over `content` in a `superRefine` — exactly one text item, at
 * most one first_frame, frame roles and reference roles being mutually
 * exclusive, reference caps, reference_audio never alone, a concrete ratio
 * for text-to-video. `z.toJSONSchema` drops refinements silently, so those
 * rules are stated in `.describe()` prose instead and MiniMax answers a
 * violation as error-as-data (uncharged). The object stays `.strict()`,
 * which DOES survive as `additionalProperties: false`.
 */

/** Resolutions any H3 model may serve. */
export type H3Resolution = "480P" | "768P" | "2K";

/** Longest output any H3 model produces, in seconds. */
export const MAX_H3_DURATION = 15;

/** Upstream cap on TOTAL reference-video duration, in seconds. Also the
 *  conservative reference-video figure an estimate holds against. */
export const MAX_REFERENCE_VIDEO_SECONDS = 15;

/** One H3 model, as far as the SCHEMA is concerned. */
export interface H3ModelShape {
    /** The upstream `model` string — required on every V2 request. */
    modelId: string;
    resolutions: readonly H3Resolution[];
    /** Shortest output the model accepts, in seconds. */
    minDuration: number;
    /** Accepts `reference_image` / `reference_video` / `reference_audio`. */
    supportsReference: boolean;
}

/**
 * Media URL — a PUBLIC http(s) link, ENFORCED (design D6).
 *
 * MiniMax accepts three forms; we accept exactly one.
 *   - `mm_file://{file_id}` names a file uploaded to MiniMax under MONID's
 *     API key, so a Monid caller can never produce a valid one and a
 *     guessed one would read our storage. v1 rejected it too.
 *   - `data:` URIs inline the whole asset into the request body and the
 *     run record (an image alone may be 30MB, against a 64MB body cap).
 *     v1 documented them; we do not accept them.
 *
 * v1 enforced its rule in a `superRefine`, which `z.toJSONSchema` discards.
 * A `.regex()` does NOT get discarded — it compiles to a JSON Schema
 * `pattern` the engine validates before any request leaves — so the rule is
 * a real gate here rather than prose.
 */
const zMediaUrl = z
    .string()
    .min(1)
    .regex(/^https?:\/\//, "must be a public http(s) URL")
    .describe(
        "Public http(s) URL. Nothing else is accepted: data: URIs are " +
            "rejected (they inline the whole asset into the request), and " +
            "so are MiniMax mm_file:// references (they name a file " +
            "uploaded under Monid's own credentials). Size limits still " +
            "apply at the far end: image <=30MB, reference video <=50MB, " +
            "reference audio <=15MB, whole request body <=64MB.",
    );

const zTextItem = z.strictObject({
    type: z.literal("text"),
    text: z
        .string()
        .min(1)
        .max(7000)
        .describe(
            "Prompt describing the video (max 7000 characters). REQUIRED in " +
                "every request, in every scenario — exactly one text item.",
        ),
});

const zVideoItem = z.strictObject({
    type: z.literal("video_url"),
    video_url: z.strictObject({ url: zMediaUrl }),
    role: z
        .literal("reference_video")
        .describe(
            "Reference video (reference-to-video only, max 3 items). " +
                "MP4/MOV, H.264 or H.265, 2-15s per clip and <=15s total. " +
                "Input video seconds are BILLED in addition to the " +
                "generated output.",
        ),
});

const zAudioItem = z.strictObject({
    type: z.literal("audio_url"),
    audio_url: z.strictObject({ url: zMediaUrl }),
    role: z
        .literal("reference_audio")
        .describe(
            "Reference audio (reference-to-video only, max 3 items; cannot " +
                "be the ONLY reference — pair it with a reference_image or " +
                "reference_video). WAV/MP3, 2-15s per clip and <=15s total. " +
                "Reference audio is free.",
        ),
});

/** Image item — the role vocabulary shrinks to frames on non-reference
 *  models, so a model can only accept what it serves. */
function makeImageItem(shape: H3ModelShape) {
    return z.strictObject({
        type: z.literal("image_url"),
        image_url: z.strictObject({ url: zMediaUrl }),
        role: z
            .enum(
                shape.supportsReference
                    ? ["first_frame", "last_frame", "reference_image"]
                    : ["first_frame", "last_frame"],
            )
            .describe(
                "first_frame (the DEFAULT when a single image carries no " +
                    "role — at most one), last_frame (at most one, and only " +
                    "alongside a first_frame)" +
                    (shape.supportsReference
                        ? ", or reference_image (reference-to-video, max 9). " +
                            "Frame roles and reference roles are MUTUALLY " +
                            "EXCLUSIVE — an image with no role counts as a " +
                            "first_frame for this rule"
                        : ". Reference images, video and audio are not " +
                            "supported on this model") +
                    ". Formats: JPG, JPEG, PNG, WEBP, HEIC, HEIF; 256-5760px " +
                    "per side; aspect ratio 0.4-2.5.",
            )
            .optional(),
    });
}

function makeContentItem(shape: H3ModelShape) {
    return shape.supportsReference
        ? z.discriminatedUnion("type", [
            zTextItem,
            makeImageItem(shape),
            zVideoItem,
            zAudioItem,
        ])
        : z.discriminatedUnion("type", [zTextItem, makeImageItem(shape)]);
}

/** Concrete (non-`adaptive`) aspect ratios. */
const CONCRETE_RATIOS = [
    "21:9",
    "16:9",
    "4:3",
    "1:1",
    "3:4",
    "9:16",
] as const;

/**
 * The per-model H3 request body — the faithful vendor mirror (design D25:
 * optionality only, no `.default()`; tightening happens at the binding).
 *
 * `model`, `resolution` and `duration` are REQUIRED by the vendor and stay
 * required here. `resolution` in particular MUST NOT be defaulted: it
 * selects the per-second rate line, so a missing value has to be a
 * validation error rather than a silently mispriced run.
 *
 * `callback_url` is deliberately NOT exposed — relaying a caller-supplied
 * URL that MiniMax will POST to is an SSRF/exfiltration seam plus a
 * challenge handshake Monid does not serve.
 */
export function makeH3VideoBody(shape: H3ModelShape) {
    const [firstRes, ...restRes] = shape.resolutions;
    return z.strictObject({
        model: z
            .literal(shape.modelId)
            .describe(`Fixed to ${shape.modelId}. Required.`),
        content: z
            .array(makeContentItem(shape))
            .min(1)
            .describe(
                "Multimodal input. Every request needs EXACTLY ONE non-empty " +
                    "text item. Add first_frame/last_frame images for " +
                    "image-to-video" +
                    (shape.supportsReference
                        ? ", OR reference_image/reference_video/" +
                            "reference_audio items for reference-to-video — " +
                            "the two families cannot be mixed. Caps: 9 " +
                            "reference_image, 3 reference_video, 3 " +
                            "reference_audio; reference_audio cannot be the " +
                            "only reference."
                        : ". Reference images, video and audio are not " +
                            "supported on this model."),
            ),
        resolution: z
            .enum([firstRes, ...restRes])
            .describe(
                "Output resolution. Selects the per-second rate — see the " +
                    "endpoint description for the model's published rates.",
            ),
        duration: z
            .number()
            .int()
            .min(shape.minDuration)
            .max(MAX_H3_DURATION)
            .describe(
                `Output length in seconds, ${shape.minDuration}-${MAX_H3_DURATION}. ` +
                    "Billed per generated second.",
            ),
        ratio: z
            .enum(["adaptive", ...CONCRETE_RATIOS])
            .describe(
                "Aspect ratio. REQUIRED and must NOT be adaptive for " +
                    "text-to-video (use one of " + CONCRETE_RATIOS.join(", ") +
                    "). Image-to-video always resolves to adaptive — the " +
                    "input image decides." +
                    (shape.supportsReference
                        ? " Reference-to-video defaults to adaptive but " +
                            "accepts a concrete ratio."
                        : ""),
            )
            .optional(),
    });
}
