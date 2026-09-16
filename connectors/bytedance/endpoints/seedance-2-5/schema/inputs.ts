import { z } from "zod";
import {
    contentArray,
    sharedTaskFields,
    zRatio,
} from "../../../schema/content.ts";

/**
 * Ark create-task body for Seedance 2.5 — the faithful vendor mirror (D25):
 * optionality only, no defaults (those live at the binding).
 *
 * 2.5 is NOT a bigger 2.0. It doubles the duration ceiling to 30s and raises
 * the reference budget to 50 assets, but DROPS 1080p and 4K, adds a `mov`
 * output container, accepts a pure-audio reference, and sorts every request
 * into a task type whose parameter rules it then enforces — see the
 * endpoint's notes.
 */
export const zSeedance25Body = z.object({
    content: contentArray({
        images: 30,
        videos: 10,
        audios: 10,
        clipSeconds: 30,
        audioOnly: true,
    }),
    resolution: z
        .enum(["480p", "720p"])
        .describe(
            "Output resolution. Both tiers bill at the same rate per token, " +
                "but 720p uses about twice as many tokens as 480p. 2.5 does " +
                "not serve 1080p or 4K — use Seedance 2.0 for those.",
        )
        .optional(),
    /**
     * `"auto"` is OUR name for Ark's `-1` sentinel, translated at the wire
     * boundary by the endpoint's `toRequest` (design D8). Publishing a named
     * mode keeps the JSON Schema self-describing — a union of "4..30" and
     * "auto", rather than `minimum: -1` plus a prose caveat — and keeps a
     * genuinely bad `duration: -5` out of range instead of next door to the
     * sentinel.
     */
    duration: z
        .union([z.number().int().min(4).max(30), z.literal("auto")])
        .describe(
            'Duration in seconds (4-30), or "auto" to let the model choose ' +
                'the length from your prompt and inputs. "auto" is REQUIRED ' +
                "for video editing, where the output matches the source clip " +
                'and no explicit duration is accepted. Cost note: "auto" ' +
                "holds the price of a 30-second video up front — the unused " +
                "portion is released when the run settles on actual usage.",
        )
        .optional(),
    ratio: zRatio
        .describe(
            '"adaptive" (the default) matches your inputs and is ALWAYS ' +
                "safe. A specific ratio is accepted ONLY for text-to-video " +
                "and reference-to-video. First-frame/last-frame, video " +
                "editing, and video extension all inherit the aspect ratio " +
                'of their source and REQUIRE "adaptive".',
        )
        .optional(),
    output_format: z
        .enum(["mp4", "mov"])
        .describe(
            '"mp4" plays everywhere — web, mobile, players, social ' +
                'platforms. "mov" uses H.264 + yuv444p + PCM for higher ' +
                "colour fidelity in grading, keying, and compositing " +
                "(recommended for video editing and extension), but most " +
                "browsers cannot play it — use VLC, mpv, ffplay, or IINA.",
        )
        .optional(),
    ...sharedTaskFields,
}).strict();
