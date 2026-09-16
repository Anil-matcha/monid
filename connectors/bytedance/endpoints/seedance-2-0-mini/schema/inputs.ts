import { z } from "zod";
import {
    contentArray,
    sharedTaskFields,
    zRatio,
} from "../../../schema/content.ts";

/**
 * Ark create-task body for Seedance 2.0 Mini — the faithful vendor mirror
 * (D25): optionality only, no defaults (those live at the binding).
 *
 * Mini is the bulk-generation tier: the same capability surface as Fast at
 * the family's lowest rate.
 */
export const zSeedance20MiniBody = z.object({
    content: contentArray({
        images: 9,
        videos: 3,
        audios: 3,
        clipSeconds: 15,
        audioOnly: false,
    }),
    resolution: z
        .enum(["480p", "720p"])
        .describe(
            "Output resolution. Both tiers bill at the same rate per token, " +
                "but 720p uses about twice as many tokens as 480p.",
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
