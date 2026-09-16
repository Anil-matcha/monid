import { z } from "zod";

/**
 * Shared Ark create-task fragments for the Seedance video family (ported from
 * v1 `endpoints/video-generation/video-common.ts`).
 *
 * Every Seedance model posts the SAME body shape to the same task API; what
 * differs per model is which values it accepts (resolutions, duration ceiling,
 * output containers) and how many reference assets it takes. So the STRUCTURE
 * lives here and the per-model enums live in each endpoint's own
 * `schema/inputs.ts` — a model can never be handed a value it has no rate for.
 *
 * The reference caps are a parameter rather than a constant because they are
 * quoted in the `.describe()` text: 2.0 takes 9 images, 2.5 takes 30, and a
 * describe that lies is worse than no describe.
 */

/**
 * A reference URL: a public `https://` URL. Ark fetches these server-side, so
 * the target has to be reachable from the public internet.
 *
 * `.regex()` rather than `.refine()` on purpose: a refinement is silently
 * dropped by `z.toJSONSchema`, but a regex compiles to a JSON Schema `pattern`
 * that the engine's validator enforces. Single-field constraints CAN be
 * expressed here; only cross-field rules have to fall back to `meta.notes`.
 */
export const zRefUrl = z
    .string()
    .regex(/^https:\/\/\S+$/, "must be a public https:// URL")
    .describe("A public https:// URL.");

/** Aspect ratios Ark accepts; `adaptive` picks the best fit from the inputs. */
export const zRatio = z.enum([
    "16:9",
    "4:3",
    "1:1",
    "3:4",
    "9:16",
    "21:9",
    "adaptive",
]);

/** Caps on the reference assets accepted in ONE request, per model. */
export interface RefCaps {
    /** Max `reference_image` items. */
    images: number;
    /** Max `reference_video` items. */
    videos: number;
    /** Max `reference_audio` items. */
    audios: number;
    /** Max seconds per individual clip (documented only — we never fetch the
     *  media, so this cannot be checked, only quoted). */
    clipSeconds: number;
    /** `reference_audio` may stand alone, with no image or video (2.5 only). */
    audioOnly: boolean;
}

/**
 * One `content[]` item — a discriminated union on `type`. The generation MODE
 * is chosen by what the array holds: text alone is text-to-video, an image is
 * image-to-video (or a pinned first/last frame), video and audio are
 * multimodal reference-to-video.
 *
 * NOTE on `role`: it is OPTIONAL on every variant, and omitting it does not
 * mean "no role" — Ark substitutes a default. A bare image_url IS a
 * `first_frame` (the plain image-to-video call); a bare video_url/audio_url IS
 * a reference clip, because that is the only role those types accept.
 */
export function contentItem(caps: RefCaps) {
    return z.discriminatedUnion("type", [
        z.object({
            type: z.literal("text"),
            text: z
                .string()
                .min(1)
                .max(6000)
                .describe(
                    "Text prompt describing the video (recommended under " +
                        "1000 words). Refer to your other content items by " +
                        "ordinal, numbered per type in array order: @Image1, " +
                        "@Image2, @Video1, @Audio1 — and say what each one " +
                        "supplies (appearance, motion, timbre) and what it " +
                        "should not. Mark sounds with () music, <> sound " +
                        "effects, {} dialogue, 【】 subtitles; prefix " +
                        "non-English dialogue with its language.",
                ),
        }).strict(),
        z.object({
            type: z.literal("image_url"),
            image_url: z.object({ url: zRefUrl }).strict(),
            role: z
                .enum(["first_frame", "last_frame", "reference_image"])
                .describe(
                    "first_frame (image-to-video, the default when omitted) " +
                        "pins the exact opening frame; last_frame (only " +
                        "alongside a first_frame) pins the closing one; " +
                        `reference_image (up to ${caps.images}) is soft ` +
                        "guidance for subject or style, not a frame. At most " +
                        "one first_frame and one last_frame per request.",
                )
                .optional(),
        }).strict(),
        z.object({
            type: z.literal("video_url"),
            video_url: z.object({ url: zRefUrl }).strict(),
            role: z
                .literal("reference_video")
                .describe(
                    `Reference video (up to ${caps.videos}, each 2-` +
                        `${caps.clipSeconds}s) for multimodal generation, ` +
                        "video editing, or video extension. Requests " +
                        "carrying one are billed at the vendor's " +
                        "reference-video rate.",
                )
                .optional(),
        }).strict(),
        z.object({
            type: z.literal("audio_url"),
            audio_url: z.object({ url: zRefUrl }).strict(),
            role: z
                .literal("reference_audio")
                .describe(
                    `Reference audio (up to ${caps.audios}, each 2-` +
                        `${caps.clipSeconds}s).` +
                        (caps.audioOnly
                            ? " May be the only reference."
                            : " Cannot be the only input — include at least " +
                                "one image or video."),
                )
                .optional(),
        }).strict(),
    ]);
}

/**
 * The `content[]` array. `.min(1)` is the only cross-item rule that survives
 * compilation — the rest (one first_frame, last_frame needs a first_frame,
 * per-role caps) cannot be expressed in JSON Schema and live in the
 * endpoint's `meta.notes` instead (design D6).
 */
export function contentArray(caps: RefCaps) {
    return z
        .array(contentItem(caps))
        .min(1)
        .describe(
            "Content items, which choose the generation mode: text " +
                "(text-to-video), image_url (image-to-video, or a pinned " +
                "first/last frame, or reference images), video_url and " +
                "audio_url (multimodal reference-to-video).",
        );
}

/** Flags every Seedance model accepts, identical across the family. */
export const sharedTaskFields = {
    generate_audio: z
        .boolean()
        .describe(
            "Generate synchronized audio — voices, sound effects, music. " +
                "Defaults to true upstream. No price impact.",
        )
        .optional(),
    watermark: z
        .boolean()
        .describe('Add an "AI Generated" watermark. Defaults to false.')
        .optional(),
    priority: z
        .number()
        .int()
        .min(0)
        .max(9)
        .describe(
            "Queue priority 0-9 (higher goes to the front). Defaults to 0.",
        )
        .optional(),
};
