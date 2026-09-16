import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zSeedance20Body } from "./schema/inputs.ts";

/**
 * Seedance 2.0 — the highest-quality tier (up to 4K, 10-bit HDR-grade colour)
 * with audio-visual sync. The async machinery (lifecycle, fromError,
 * consolidate, credit pool) is inherited from the provider; what lives here is
 * this model's identity, capability surface and rate card.
 *
 * 2.0 is the only Seedance model whose published rate varies across
 * resolutions, which is why its composite carries eight lines rather than
 * four.
 */
export default defineEndpoint({
    meta: {
        displayName: "Seedance 2.0 Video (BytePlus)",
        summary:
            "Generate video from text, images, or reference clips — up to 4K with audio.",
        description: "Generate AI video with ByteDance Seedance 2.0, the " +
            "highest-quality Seedance tier — up to 4K (10-bit HDR-grade " +
            "colour) with audio-visual sync. Turn a text prompt into a video " +
            "(text-to-video), animate a still image (image-to-video), pin " +
            "exact first and last frames, or steer generation with reference " +
            "images, video clips, and audio (reference-to-video, which also " +
            "covers video editing and extension). Generates synchronized " +
            "audio — voices, sound effects, background music — and returns a " +
            "downloadable MP4 video_url, 4-15 seconds long. Use cases: " +
            "short-form social clips, ads and marketing b-roll, product " +
            "demos, storyboarding and previz, animating stills, music videos.",
        categories: ["video-generation"],
        notes: [
            "A lower per-token rate does NOT mean a cheaper video. 4K bills " +
            "$4.00 per 1M tokens against 720p's $7.00, but uses nine times " +
            "as many tokens — so a 4K run costs about five times a 720p " +
            "run, and is the most expensive one here.",
        ],
    },
    /** PUBLIC identity: the friendly model name. Pinned because all four
     *  Seedance endpoints share one create-task path, so the derived
     *  `?? request.path` default would collide (design D1). */
    endpoint: "/seedance-2.0",
    request: { method: "POST", path: "/api/v3/contents/generations/tasks" },
    input: {
        schema: {
            // Vendor defaults applied at the BINDING (D25 — the mirror stays
            // optionality-only). `resolution` and `duration` must both be
            // present after this: the estimate reads them directly, so the
            // hold has to be deducible from the input alone (D24).
            body: zSeedance20Body.extend({
                resolution: zSeedance20Body.shape.resolution.unwrap()
                    .default("720p"),
                duration: zSeedance20Body.shape.duration.unwrap().default(5),
            }),
        },
        /** Inject the pinned BytePlus inference-endpoint handle (design D8) —
         *  the endpoint IS the model, so `model` is never caller-supplied.
         *  `utils.json.merge` rather than a spread: toRequest sits outside
         *  the typed layer (its body is `Json`), and `utils.json` is the
         *  idiom for raw values here — same as exa's `omit`. */
        toRequest: ({ data, utils }) => ({
            ...data.input,
            body: utils.json.merge(data.input.body ?? {}, {
                model: "ep-20260719072449-96psr",
            }),
        }),
    },
    usage: {
        /** The VENDOR's rate card, both published columns (design D2/D3):
         *  BytePlus prices per resolution AND per whether the input carried a
         *  reference video (the with-video column is LOWER). Selection is a
         *  COUNTING rule — the fns below put the token count on the one line
         *  that applies — never a model shape (D19).
         *
         *  `every: 1` with amount = rate ÷ 1e6 keeps the fold exact:
         *  `ceil(tokens/1) × amount`. A coarser block would round a
         *  108k-token run up to a whole million. */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                "480p": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.TOKEN,
                    label: "480p",
                    description: "$7.00 per 1M output tokens",
                    consumes: { credit: "default", amount: 0.000007 },
                },
                "480p_with_video": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.TOKEN,
                    label: "480p + reference video",
                    description: "$4.30 per 1M output tokens",
                    consumes: { credit: "default", amount: 0.0000043 },
                },
                "720p": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.TOKEN,
                    label: "720p",
                    description: "$7.00 per 1M output tokens",
                    consumes: { credit: "default", amount: 0.000007 },
                },
                "720p_with_video": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.TOKEN,
                    label: "720p + reference video",
                    description: "$4.30 per 1M output tokens",
                    consumes: { credit: "default", amount: 0.0000043 },
                },
                "1080p": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.TOKEN,
                    label: "1080p",
                    description: "$7.70 per 1M output tokens",
                    consumes: { credit: "default", amount: 0.0000077 },
                },
                "1080p_with_video": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.TOKEN,
                    label: "1080p + reference video",
                    description: "$4.70 per 1M output tokens",
                    consumes: { credit: "default", amount: 0.0000047 },
                },
                "4k": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.TOKEN,
                    label: "4K",
                    description: "$4.00 per 1M output tokens",
                    consumes: { credit: "default", amount: 0.000004 },
                },
                "4k_with_video": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.TOKEN,
                    label: "4K + reference video",
                    description: "$2.40 per 1M output tokens",
                    consumes: { credit: "default", amount: 0.0000024 },
                },
            },
        },
        /** The vendor's own token formula, deduced from the input (D5):
         *  `width × height × 24fps × seconds / 1024`. The dimension table is
         *  INLINED because hook fns are closed terms — nothing may be
         *  imported. `adaptive` (or an omitted ratio) estimates with the 16:9
         *  dimensions: pixel counts across ratios at one resolution differ by
         *  under 5%, and the settle uses actual tokens regardless. */
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
                "1080p": {
                    "16:9": [1920, 1080],
                    "4:3": [1664, 1248],
                    "1:1": [1440, 1440],
                    "3:4": [1248, 1664],
                    "9:16": [1080, 1920],
                    "21:9": [2206, 946],
                },
                "4k": {
                    "16:9": [3840, 2160],
                    "4:3": [3326, 2494],
                    "1:1": [2880, 2880],
                    "3:4": [2494, 3326],
                    "9:16": [2160, 3840],
                    "21:9": [4398, 1886],
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
                : body.resolution === "720p"
                ? "720p_with_video"
                : body.resolution === "1080p"
                ? "1080p_with_video"
                : "4k_with_video";
            return { counts: { [key]: tokens } };
        },
        /** Settle on the vendor's OWN meter — `usage.completion_tokens` — but
         *  keyed from the REQUEST (design D4). v1 read the rate keys off the
         *  poll body's echo and recorded $0 on every run for weeks when
         *  BytePlus silently changed what it echoed; the input cannot drift. */
        evidence: ({ data, utils, logger }) => {
            const tokens = utils.json.optionalNum(
                data.output,
                "$.usage.completion_tokens",
            );
            if (tokens === undefined) {
                // Succeeded without a meter — a vendor anomaly. Zero-billed
                // (the basis is missing), said out loud for follow-up.
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
                : body.resolution === "720p"
                ? "720p_with_video"
                : body.resolution === "1080p"
                ? "1080p_with_video"
                : "4k_with_video";
            return { counts: { [key]: tokens } };
        },
    },
});
