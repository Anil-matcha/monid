import { z } from "zod";

/**
 * MuAPI Seedance 2.5 text-to-video request body — the faithful vendor
 * mirror (D25): optionality only, with documented defaults applied at the
 * endpoint binding.
 */
export const zMuapiSeedance25VideoBody = z.strictObject({
    prompt: z
        .string()
        .min(1)
        .describe("Text prompt describing the scene and motion."),
    resolution: z
        .enum(["480p", "720p", "1080p", "4k"])
        .describe(
            "Output resolution. Pricing scales with resolution; 480p is " +
                "the least expensive and 4K the most expensive.",
        )
        .optional(),
    duration: z
        .number()
        .int()
        .min(4)
        .max(30)
        .describe("Output duration in seconds (4-30).")
        .optional(),
    aspect_ratio: z
        .enum([
            "adaptive",
            "16:9",
            "9:16",
            "1:1",
            "4:3",
            "3:4",
            "21:9",
            "9:21",
        ])
        .describe("Output aspect ratio.")
        .optional(),
    seed: z
        .number()
        .int()
        .min(-1)
        .max(4294967295)
        .describe("Random seed; use -1 for a random seed.")
        .optional(),
    high_bitrate: z
        .boolean()
        .describe("Enable high-bitrate output for larger files.")
        .optional(),
});
