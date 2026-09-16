import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zSeedance20MiniBody } from "./schema/inputs.ts";

/**
 * Seedance 2.0 Mini — the cheapest tier (480p/720p) with audio-visual sync,
 * for bulk generation. Async machinery is inherited from the provider.
 */
export default defineEndpoint({
    meta: {
        displayName: "Seedance 2.0 Mini Video (BytePlus)",
        summary:
            "Cheapest Seedance tier for bulk video generation (480p/720p).",
        description:
            "Generate AI video with ByteDance Seedance 2.0 Mini, the " +
            "cheapest Seedance tier for bulk generation (480p/720p) with " +
            "audio-visual sync. Turn a text prompt into a video " +
            "(text-to-video), animate a still image (image-to-video), pin " +
            "exact first and last frames, or steer generation with reference " +
            "images, video clips, and audio (reference-to-video, which also " +
            "covers video editing and extension). Generates synchronized " +
            "audio — voices, sound effects, background music — and returns a " +
            "downloadable MP4 video_url, 4-15 seconds long. Use cases: " +
            "high-volume variant generation, A/B testing creative, cheap " +
            "first passes before re-running a winner on a higher tier.",
        categories: ["video-generation"],
    },
    /** PUBLIC identity: the friendly model name (design D1). */
    endpoint: "/seedance-2.0-mini",
    request: { method: "POST", path: "/api/v3/contents/generations/tasks" },
    input: {
        schema: {
            // vendor defaults at the BINDING (D25); resolution + duration must
            // be present after this so the estimate is deducible (D24)
            body: zSeedance20MiniBody.extend({
                resolution: zSeedance20MiniBody.shape.resolution.unwrap()
                    .default("720p"),
                duration: zSeedance20MiniBody.shape.duration.unwrap()
                    .default(5),
            }),
        },
        /** Pinned inference-endpoint handle (design D8). */
        toRequest: ({ data, utils }) => ({
            ...data.input,
            body: utils.json.merge(data.input.body ?? {}, {
                model: "ep-20260719074900-2b555",
            }),
        }),
    },
    usage: {
        /** The VENDOR's published rate card, both columns (design D2/D3). */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                "480p": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.TOKEN,
                    label: "480p",
                    description: "$3.50 per 1M output tokens",
                    consumes: { credit: "default", amount: 0.0000035 },
                },
                "480p_with_video": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.TOKEN,
                    label: "480p + reference video",
                    description: "$2.10 per 1M output tokens",
                    consumes: { credit: "default", amount: 0.0000021 },
                },
                "720p": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.TOKEN,
                    label: "720p",
                    description: "$3.50 per 1M output tokens",
                    consumes: { credit: "default", amount: 0.0000035 },
                },
                "720p_with_video": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.TOKEN,
                    label: "720p + reference video",
                    description: "$2.10 per 1M output tokens",
                    consumes: { credit: "default", amount: 0.0000021 },
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
