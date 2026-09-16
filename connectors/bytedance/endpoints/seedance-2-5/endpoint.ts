import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zSeedance25Body } from "./schema/inputs.ts";

/**
 * Seedance 2.5 — the flagship tier: up to 30 seconds of coherent story in one
 * request, 50 multimodal reference assets, video editing and extension, and
 * native audio in 11 languages. Async machinery is inherited from the
 * provider; the extra capability surface (auto duration, output container,
 * audio-only references, task types) lives here.
 */
export default defineEndpoint({
    meta: {
        displayName: "Seedance 2.5 Video (BytePlus)",
        summary:
            "Flagship Seedance: up to 30s, 50 reference assets, video editing and extension.",
        description:
            "Generate AI video with ByteDance Seedance 2.5, the flagship " +
            "Seedance tier — up to 30 seconds of coherent story in a single " +
            "request, 50 multimodal reference assets, video editing and " +
            "extension, and native audio in 11 languages. Turn a text prompt " +
            "into a video (text-to-video), animate a still image " +
            "(image-to-video), pin exact first and last frames, or steer " +
            "generation with reference images, video clips, and audio " +
            "(reference-to-video). Returns a downloadable MP4 or MOV " +
            "video_url, 4-30 seconds long. 2.5 tops out at 720p — use " +
            "Seedance 2.0 for 1080p or 4K. Use cases: multi-shot narrative " +
            "clips, editing and extending existing footage, ads with " +
            "scripted dialogue, music videos.",
        categories: ["video-generation"],
        /** 2.5 sorts every request into one of five task types and then
         *  rejects parameters that contradict the type it inferred. Editing
         *  and extension are classified from PROMPT WORDING, which we do not
         *  interpret — so for those, this text is the only mechanism there
         *  is. The second note earns its length: a keyword-less "edit" prompt
         *  does not error, it silently returns a plausible but WRONG video
         *  and bills in full. */
        notes: [
            "The model infers what you want from the content[] roles and " +
            "your prompt wording. Editing and extension REQUIRE ratio " +
            '"adaptive", which is the default — leave it alone when in ' +
            'doubt. Editing ALSO requires duration "auto"; the default is ' +
            '5 seconds, so pass duration "auto" explicitly for an edit.',

            'To edit or extend a video, say so explicitly: "Video edit: ' +
            'remove everyone in @Video1 except the protagonist", or "Extend ' +
            '@Video1: after the window opens, move into @Video2". Without ' +
            "that wording the model reads it as a plain reference-to-video " +
            "request and generates a NEW video from your clips — which " +
            "succeeds and is billed in full, with no error to catch.",

            "Refer to your inputs in the prompt by ordinal, numbered per " +
            "type in content[] order: @Image1, @Image2, @Video1, @Audio1. " +
            "Mark sounds with () music, <> effects, {} dialogue, 【】 " +
            "subtitles.",

            'Because duration "auto" lets the MODEL pick the length, the ' +
            "cost estimate is an UPPER BOUND — it reserves a full 30-second " +
            "video and releases the unused portion when the run settles on " +
            "actual usage. Pass an explicit duration for a tight estimate.",

            "Unlike the 2.0 family, 2.5 accepts a reference audio clip as " +
            "the ONLY input, with no image or video alongside it.",
        ],
    },
    /** PUBLIC identity: the friendly model name (design D1). */
    endpoint: "/seedance-2.5",
    request: { method: "POST", path: "/api/v3/contents/generations/tasks" },
    input: {
        schema: {
            // Vendor defaults at the BINDING (D25). `ratio` defaults to
            // "adaptive" — the ONE value every task type accepts — because
            // 2.5 rejects a contradicting ratio, sometimes only after the
            // task has queued.
            body: zSeedance25Body.extend({
                resolution: zSeedance25Body.shape.resolution.unwrap()
                    .default("720p"),
                duration: zSeedance25Body.shape.duration.unwrap().default(5),
                ratio: zSeedance25Body.shape.ratio.unwrap()
                    .default("adaptive"),
                output_format: zSeedance25Body.shape.output_format.unwrap()
                    .default("mp4"),
            }),
        },
        /** Pinned inference-endpoint handle, plus the `"auto"` → `-1`
         *  translation at the wire boundary (design D8) — so the published
         *  schema never has to expose a magic number. */
        toRequest: ({ data, utils }) => {
            const body = data.input.body ?? {};
            const duration = utils.json.optionalGet(body, "$.duration");
            return {
                ...data.input,
                body: utils.json.merge(body, {
                    ...(duration === "auto" ? { duration: -1 } : {}),
                    model: "ep-20260807161710-ln7d6",
                }),
            };
        },
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
                    description: "$10.70 per 1M output tokens",
                    consumes: { credit: "default", amount: 0.0000107 },
                },
                "480p_with_video": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.TOKEN,
                    label: "480p + reference video",
                    description: "$6.40 per 1M output tokens",
                    consumes: { credit: "default", amount: 0.0000064 },
                },
                "720p": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.TOKEN,
                    label: "720p",
                    description: "$10.70 per 1M output tokens",
                    consumes: { credit: "default", amount: 0.0000107 },
                },
                "720p_with_video": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.TOKEN,
                    label: "720p + reference video",
                    description: "$6.40 per 1M output tokens",
                    consumes: { credit: "default", amount: 0.0000064 },
                },
            },
        },
        /** The vendor's token formula (design D5). `"auto"` defers the length
         *  to the MODEL, so the estimate takes the worst case it may pick —
         *  30s. Under-estimating would let a run settle past the budget that
         *  admitted it; over-estimating is released at settle. Note the
         *  literal comparison: v1 used `Number(duration)` here, and
         *  `Number("auto")` is NaN, which collapsed to the 5s default and
         *  under-held a 30s run by ~6×. */
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
            const ratio = body.ratio === "adaptive" ? "16:9" : body.ratio;
            const size = dims[body.resolution][ratio];
            const seconds = body.duration === "auto" ? 30 : body.duration;
            const tokens = Math.round(
                size[0] * size[1] * 24 * seconds / 1024,
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
        /** Settle on the vendor's meter, keyed from the REQUEST (design D4) —
         *  the ACTUAL length the model chose is already reflected in the
         *  token count, so `"auto"` needs no special handling here. */
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
