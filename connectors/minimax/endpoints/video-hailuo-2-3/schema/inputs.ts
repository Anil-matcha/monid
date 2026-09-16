import { z } from "zod";

/**
 * MiniMax Hailuo-2.3 video request body — the faithful vendor mirror
 * (design D25: optionality only; defaults applied at the binding).
 *
 * SHAPE NOTE (design D6): v1 encoded two rules structurally, as
 * `zCommon.and(zMode).and(zResDur)` — an intersection whose `anyOf` arms
 * said "prompt OR first_frame_image" and "1080P implies 6s". That compiles
 * to an `allOf` of `anyOf`s that is not usefully checkable once each block
 * carries its own `additionalProperties`, and the estimate needs a flat,
 * typed read of `resolution`/`duration` anyway (they select the price
 * cell). So the body is ONE flat `.strict()` object and both rules ride in
 * prose; MiniMax answers a violation as error-as-data (uncharged).
 *
 * `resolution` and `duration` ARE the rate card's coordinates — MiniMax
 * prices Hailuo per finished video, in three published cells — so they
 * carry the vendor's own defaults at the binding and are always present by
 * the time the estimate runs.
 */

/** The three published Hailuo-2.3 cells, as coordinates. */
export const HAILUO_RESOLUTIONS = ["768P", "1080P"] as const;

export const zHailuoVideoBody = z.strictObject({
    model: z
        .literal("MiniMax-Hailuo-2.3")
        .describe("Fixed to MiniMax-Hailuo-2.3.")
        .optional(),
    prompt: z
        .string()
        .max(2000)
        .describe(
            "Text description of the video (max 2000). REQUIRED for " +
                "text-to-video; optional as a caption when " +
                "first_frame_image is given. Supports [camera command] " +
                "syntax, e.g. [Push in], [Pan left], [Zoom out].",
        )
        .optional(),
    first_frame_image: z
        .string()
        .min(1)
        .regex(/^https?:\/\//, "must be a public http(s) URL")
        .describe(
            "Starting-frame image for image-to-video, as a public http(s) " +
                "URL. data: URIs are NOT accepted (design D6 — they inline " +
                "the whole asset into the request). JPG/PNG/WebP, <20MB, " +
                "short edge >300px, aspect ratio between 2:5 and 5:2. " +
                "Provide EITHER this or prompt (or both) — a request with " +
                "neither is rejected.",
        )
        .optional(),
    resolution: z
        .enum(HAILUO_RESOLUTIONS)
        .describe(
            "Output resolution. Together with duration it selects the " +
                "price cell: 768P/6s $0.28, 768P/10s $0.56, 1080P/6s " +
                "$0.49. Defaults to 768P.",
        )
        .optional(),
    duration: z
        .union([z.literal(6), z.literal(10)])
        .describe(
            "Output length in seconds. 768P supports 6 or 10; 1080P " +
                "supports 6 ONLY. Defaults to 6.",
        )
        .optional(),
    prompt_optimizer: z
        .boolean()
        .describe("Auto-optimize the prompt. Defaults to true.")
        .optional(),
    fast_pretreatment: z
        .boolean()
        .describe(
            "Reduce optimization time when prompt_optimizer is on. " +
                "Defaults to false.",
        )
        .optional(),
});
