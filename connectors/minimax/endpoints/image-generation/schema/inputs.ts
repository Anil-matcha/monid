import { z } from "zod";

/**
 * MiniMax Image Generation request body — the faithful vendor mirror
 * (design D25: optionality only; defaults applied at the binding).
 *
 * ONE endpoint serves both modes, distinguished purely by what is sent:
 *   - text-to-image  → `prompt` alone (image-01)
 *   - image-to-image → `subject_reference` (a character portrait), with
 *                      image-01 OR image-01-live
 *
 * SHAPE NOTE (design D6): v1 encoded the model↔field rules structurally,
 * as a `z.discriminatedUnion` behind a `z.preprocess` that filled in
 * `model` so the discriminator would be present. Neither survives this
 * pipeline — `z.toJSONSchema` in input mode resolves a preprocess to its
 * TARGET schema and never runs the function, and a `.default()` sitting
 * under a transform is deleted from the compiled doc outright. So the
 * body is ONE flat `.strict()` object and the two rules ride in prose:
 *   1. `width`/`height` are only effective for image-01.
 *   2. image-01-live is an image-to-image model — it requires a
 *      `subject_reference`.
 * MiniMax answers a violation as error-as-data (uncharged).
 *
 * The upside: `.strict()` DOES survive, as `additionalProperties: false`,
 * so unknown keys are rejected at validation. That retires v1's
 * provider-layer `INTERSECTION_ALLOWED_KEYS` allowlist, which existed
 * only because an intersection could not express it.
 */

const zAspectRatio = z.enum([
    "1:1",
    "16:9",
    "4:3",
    "3:2",
    "2:3",
    "3:4",
    "9:16",
    "21:9",
]);

/** The exposed image models. Price is $0.0035 per generated image for
 *  both — independent of mode and model. */
export const MINIMAX_IMAGE_MODELS = ["image-01", "image-01-live"] as const;

/** Generated-image bounds — MiniMax produces 1-9 per call. */
export const IMAGE_N_MIN = 1;
export const IMAGE_N_MAX = 9;

export const zImageGenerationBody = z.strictObject({
    model: z
        .enum(MINIMAX_IMAGE_MODELS)
        .describe(
            "Image model. image-01 does text-to-image AND image-to-image " +
                "and is the only model for which width/height are " +
                "effective. image-01-live is image-to-image ONLY and " +
                "REQUIRES subject_reference. Defaults to image-01.",
        )
        .optional(),
    prompt: z
        .string()
        .min(1)
        .max(1500)
        .describe("Text description of the image (max 1500). Required."),
    subject_reference: z
        .array(
            z.strictObject({
                type: z
                    .literal("character")
                    .describe(
                        "Subject type. Only `character` (portrait) is supported.",
                    ),
                image_file: z
                    .string()
                    .min(1)
                    .regex(/^https?:\/\//, "must be a public http(s) URL")
                    .describe(
                        "Reference image, as a public http(s) URL. data: " +
                            "URIs are NOT accepted (design D6 — they inline " +
                            "the whole asset into the request). JPG/JPEG/PNG, " +
                            "<10MB. A single front-facing portrait works best.",
                    ),
            }),
        )
        .min(1)
        .max(1)
        .describe(
            "Subject reference for image-to-image generation. Optional on " +
                "image-01 (its absence means text-to-image); REQUIRED on " +
                "image-01-live.",
        )
        .optional(),
    aspect_ratio: zAspectRatio
        .describe(
            "Aspect ratio. Takes priority over width/height when both are " +
                "given. Defaults to 1:1.",
        )
        .optional(),
    width: z
        .number()
        .int()
        .min(512)
        .max(2048)
        .describe(
            "Width in px. Only effective for image-01; set together with " +
                "height, divisible by 8.",
        )
        .optional(),
    height: z
        .number()
        .int()
        .min(512)
        .max(2048)
        .describe(
            "Height in px. Only effective for image-01; set together with " +
                "width, divisible by 8.",
        )
        .optional(),
    response_format: z
        .enum(["url", "base64"])
        .describe(
            "'url' links EXPIRE after 24h; 'base64' is inline and does not " +
                "expire. Defaults to url.",
        )
        .optional(),
    seed: z
        .number()
        .int()
        .describe("Random seed for reproducible images.")
        .optional(),
    n: z
        .number()
        .int()
        .min(IMAGE_N_MIN)
        .max(IMAGE_N_MAX)
        .describe(
            `Number of images to generate (${IMAGE_N_MIN}-${IMAGE_N_MAX}). ` +
                "Drives the per-image charge. Defaults to 1.",
        )
        .optional(),
    prompt_optimizer: z
        .boolean()
        .describe(
            "Enable automatic prompt optimization. Defaults to false.",
        )
        .optional(),
});
