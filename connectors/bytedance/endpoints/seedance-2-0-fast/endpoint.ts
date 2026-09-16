import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zSeedance20FastBody } from "./schema/inputs.ts";

/**
 * Seedance 2.0 Fast — the quick-draft tier (480p/720p) with audio-visual
 * sync. Same capability surface as 2.0 minus 1080p/4K, at a lower rate.
 * Async machinery is inherited from the provider.
 */
export default defineEndpoint({
    meta: {
        displayName: "Seedance 2.0 Fast Video (BytePlus)",
        summary:
            "Fast, cheaper video generation from text, images, or reference clips (480p/720p).",
        description:
            "Generate AI video with ByteDance Seedance 2.0 Fast, a faster " +
            "and cheaper Seedance tier for quick drafts and iteration " +
            "(480p/720p) with audio-visual sync. Turn a text prompt into a " +
            "video (text-to-video), animate a still image (image-to-video), " +
            "pin exact first and last frames, or steer generation with " +
            "reference images, video clips, and audio (reference-to-video, " +
            "which also covers video editing and extension). Generates " +
            "synchronized audio — voices, sound effects, background music — " +
            "and returns a downloadable MP4 video_url, 4-15 seconds long. " +
            "Use cases: iterating on a prompt before committing to a " +
            "higher-quality tier, bulk social clips, storyboarding and previz.",
        categories: ["video-generation"],
    },
    /** PUBLIC identity: the friendly model name (design D1). */
    endpoint: "/seedance-2.0-fast",
    request: { method: "POST", path: "/api/v3/contents/generations/tasks" },
    input: {
        schema: {
            // vendor defaults at the BINDING (D25); resolution + duration must
            // be present after this so the estimate is deducible (D24)
            body: zSeedance20FastBody.extend({
                resolution: zSeedance20FastBody.shape.resolution.unwrap()
                    .default("720p"),
                duration: zSeedance20FastBody.shape.duration.unwrap()
                    .default(5),
            }),
        },
        /** Pinned inference-endpoint handle (design D8). */
        toRequest: ({ data, utils }) => ({
            ...data.input,
            body: utils.json.merge(data.input.body ?? {}, {
                model: "ep-20260719074818-h8ng6",
            }),
        }),
    },
    usage: {
        /** The VENDOR's published rate card, both columns (design D2/D3).
         *  Fast's two resolutions share a rate, but the vendor publishes them
         *  as separate rows and so do we — a collapsed line would stop being
         *  re-derivable the day BytePlus splits them. */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                "480p": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.TOKEN,
                    label: "480p",
                    description: "$5.60 per 1M output tokens",
                    consumes: { credit: "default", amount: 0.0000056 },
                },
                "480p_with_video": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.TOKEN,
                    label: "480p + reference video",
                    description: "$3.30 per 1M output tokens",
                    consumes: { credit: "default", amount: 0.0000033 },
                },
                "720p": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.TOKEN,
                    label: "720p",
                    description: "$5.60 per 1M output tokens",
                    consumes: { credit: "default", amount: 0.0000056 },
                },
                "720p_with_video": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.TOKEN,
                    label: "720p + reference video",
                    description: "$3.30 per 1M output tokens",
                    consumes: { credit: "default", amount: 0.0000033 },
                },
            },
        },
        /** The vendor's token formula (design D5), dimension table inlined
         *  because hook fns are closed terms. */
        estimate: ({ data }) => {
            const body = data.input.body;
            const dims = {
                "480p": {
                    "16:9": [864, 496],
                    "4:3": [752, 560],
                    "1:1": [640, 640],
                    "3:4": [560, 752],
                    "9:16": [496, 864],
                    "21:9": [992, 432],
                },
                "720p": {
                    "16:9": [1280, 720],
                    "4:3": [1112, 834],
                    "1:1": [960, 960],
                    "3:4": [834, 1112],
                    "9:16": [720, 1280],
                    "21:9": [1470, 630],
                },
            };
            const ratio = body.ratio === undefined || body.ratio === "adaptive"
                ? "16:9"
                : body.ratio;
            const size = dims[body.resolution][ratio];
            const tokens = Math.round(
                size[0] * size[1] * 24 * body.duration / 1024,
            );
            const refVideo = body.content.some((item) =>
                item.type === "video_url"
            );
            const key = !refVideo
                ? body.resolution
                : body.resolution === "480p"
                ? "480p_with_video"
                : "720p_with_video";
            return { counts: { [key]: tokens } };
        },
        /** Settle on the vendor's meter, keyed from the REQUEST (design D4). */
        evidence: ({ data, utils, logger }) => {
            const tokens = utils.json.optionalNum(
                data.output,
                "$.usage.completion_tokens",
            );
            if (tokens === undefined) {
                logger.warn(
                    "ark task settled without usage tokens — zero-billing",
                );
                return { counts: {} };
            }
            const body = data.input.body;
            const refVideo = body.content.some((item) =>
                item.type === "video_url"
            );
            const key = !refVideo
                ? body.resolution
                : body.resolution === "480p"
                ? "480p_with_video"
                : "720p_with_video";
            return { counts: { [key]: tokens } };
        },
    },
});
