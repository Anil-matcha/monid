import { z } from "zod";
import {
    contentArray,
    sharedTaskFields,
    zRatio,
} from "../../../schema/content.ts";

/**
 * Ark create-task body for Seedance 2.0 — the faithful vendor mirror (D25):
 * optionality only, no defaults (those live at the binding in endpoint.ts).
 *
 * 2.0 is the top-quality tier: the only Seedance model serving 1080p and 4K,
 * and the only one whose published rate differs ACROSS resolutions.
 *
 * `model` is absent by design — the endpoint pins it (design D8). So are
 * `seed`, `camera_fixed`, `frames`, `draft` and `service_tier`: undocumented
 * or unsupported for this model, exactly as in v1. `.strict()` makes every one
 * of them an INVALID_INPUT rather than a silently ignored field.
 */
export const zSeedance20Body = z.object({
    content: contentArray({
        images: 9,
        videos: 3,
        audios: 3,
        clipSeconds: 15,
        audioOnly: false,
    }),
    resolution: z
        .enum(["480p", "720p", "1080p", "4k"])
        .describe(
            "Output resolution. Also the price selector: 480p and 720p bill " +
                "at the same rate, 1080p slightly higher, 4K lowest PER " +
                "TOKEN — but a 4K video uses far more tokens, so it is the " +
                "most expensive to generate.",
        )
        .optional(),
    duration: z
        .number()
        .int()
        .min(4)
        .max(15)
        .describe("Duration in seconds (4-15).")
        .optional(),
    ratio: zRatio
        .describe(
            "Aspect ratio. Omit for the upstream default (adaptive — picks " +
                "the best fit from your prompt and inputs).",
        )
        .optional(),
    ...sharedTaskFields,
}).strict();
