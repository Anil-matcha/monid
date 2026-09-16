import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zH3MaxVideoBody } from "./schema/inputs.ts";

/**
 * MiniMax-H3-Max — the V2 task API, same two hops as Standard H3.
 *
 * SPLIT LINES (design D4): H3-Max is the one model in the family whose
 * reference-video INPUT rate differs from its output rate ($0.0553 vs
 * $0.05 at 480P; $0.143 vs $0.08 at 768P). So where H3 and H3-Fast get one
 * line per resolution metered on `total_seconds`, H3-Max declares TWO per
 * resolution and meters `output_seconds` and `input_seconds` separately.
 *
 * NO IMAGE LINE: MiniMax does not bill input images on this model, so
 * there is nothing to declare — a line that never counts would be dead
 * rate card.
 */
export default defineEndpoint({
    meta: {
        displayName: "MiniMax Video (H3 Max)",
        summary: "Generate fast 5-15s video at 480P or 768P from a prompt, " +
            "frame images, or reference media.",
        description: "Generate video with MiniMax-H3-Max from a text " +
            "prompt (text-to-video), from a starting and/or ending frame " +
            "image (image-to-video), or guided by reference images, video " +
            "and audio (reference-to-video). Outputs 5 to 15 seconds at " +
            "480P or 768P; 2K is not available on this tier. H3-Max is the " +
            "high-speed member of the H3 family: a 5-second clip renders " +
            "in seconds, with strong overall quality at a lower " +
            "per-second price than Standard H3, but weaker complex " +
            "editing, reference fidelity and aesthetics. Suited to " +
            "high-frequency creation that still needs good image quality; " +
            "use MiniMax-H3 for 2K or the best reference control. Runs " +
            "asynchronously. Billed per second of generated output — $0.05 " +
            "at 480P, $0.08 at 768P — with reference-video input seconds " +
            "billed separately at $0.0553 (480P) and $0.143 (768P). Input " +
            "images are NOT billed on this model, and reference audio is " +
            "free. A failed or cancelled task costs nothing.",
        docsUrl:
            "https://platform.minimax.io/docs/api-reference/video-generation",
        categories: ["video-generation"],
    },
    endpoint: "/v1/video/minimax-h3-max",
    request: { method: "POST", path: "/v2/video_generation" },
    input: { schema: { body: zH3MaxVideoBody } },
    timeouts: { requestMs: 30_000, runMs: 1_800_000, pollMs: 10_000 },
    lifecycle: {
        start: async ({ utils, logger }) => {
            const res = await utils.request();
            if (res.status < 200 || res.status >= 300) {
                logger.warn("h3 submit non-2xx — returning as data", {
                    status: res.status,
                });
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            const taskId = utils.json.optionalGet(res.body, "$.task_id");
            if (typeof taskId !== "string" || taskId === "") {
                throw new Error("MiniMax H3 submit returned no task_id");
            }
            return { kind: "RUNNING", state: { externalRunId: taskId } };
        },
        poll: async ({ data, utils, logger }) => {
            const runId = data.lifecycle.state.externalRunId;
            if (runId === undefined) {
                throw Object.assign(
                    new Error("h3 poll without externalRunId in state"),
                    { retriable: false },
                );
            }
            const res = await utils.http({
                method: "GET",
                path: "/v2/query/video_generation/" + encodeURIComponent(runId),
            });
            if (res.status < 200 || res.status >= 300) {
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            const status = utils.json.optionalGet(res.body, "$.task.status");
            if (status === "queued" || status === "running") {
                return { kind: "RUNNING" };
            }
            if (
                status === "failed" || status === "cancelled" ||
                status === "expired"
            ) {
                logger.warn("h3 task did not succeed", {
                    runId,
                    status: String(status),
                });
                return {
                    kind: "COMPLETED",
                    httpStatus: 500,
                    providerHttpStatus: res.status,
                    output: res.body,
                };
            }
            if (status !== "succeeded") {
                logger.warn(
                    "h3 task status unrecognized — treating as in " +
                        "flight",
                    { runId, status: String(status) },
                );
                return { kind: "RUNNING" };
            }
            return {
                kind: "COMPLETED",
                httpStatus: 200,
                output: res.body,
            };
        },
    },
    usage: {
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                "480p_output_second": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.SECOND,
                    consumes: { credit: "default", amount: 0.05 },
                    label: "480P output seconds",
                    description: "generated seconds at 480P",
                },
                "480p_input_video_second": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.SECOND,
                    consumes: { credit: "default", amount: 0.0553 },
                    label: "480P input video seconds",
                    description:
                        "reference-video seconds consumed on a 480P run",
                },
                "768p_output_second": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.SECOND,
                    consumes: { credit: "default", amount: 0.08 },
                    label: "768P output seconds",
                    description: "generated seconds at 768P",
                },
                "768p_input_video_second": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.SECOND,
                    consumes: { credit: "default", amount: 0.143 },
                    label: "768P input video seconds",
                    description:
                        "reference-video seconds consumed on a 768P run",
                },
            },
        },
        /** Output seconds are the requested duration; reference-video
         *  seconds are held at the upstream 15s cap, since the real clip
         *  length is not knowable before the run. */
        estimate: ({ data }) => {
            const items = data.input.body.content;
            const referenceSeconds = items.some((item) =>
                    item.type === "video_url"
                )
                ? 15
                : 0;
            const seconds = data.input.body.duration;
            if (data.input.body.resolution === "768P") {
                return {
                    counts: {
                        "768p_output_second": seconds,
                        ...(referenceSeconds > 0
                            ? { "768p_input_video_second": referenceSeconds }
                            : {}),
                    },
                };
            }
            return {
                counts: {
                    "480p_output_second": seconds,
                    ...(referenceSeconds > 0
                        ? { "480p_input_video_second": referenceSeconds }
                        : {}),
                },
            };
        },
        /** The split card reads the split counters: `output_seconds` and
         *  `input_seconds`, never the `total_seconds` the single-rate
         *  models use. */
        evidence: ({ data, utils }) => {
            const rawOut = utils.json.optionalNum(
                data.output,
                "$.task.usage.output_seconds",
            );
            const outSeconds = rawOut !== undefined && rawOut > 0
                ? Math.floor(rawOut)
                : 0;
            const rawIn = utils.json.optionalNum(
                data.output,
                "$.task.usage.input_seconds",
            );
            const inSeconds = rawIn !== undefined && rawIn > 0
                ? Math.floor(rawIn)
                : 0;
            if (data.input.body.resolution === "768P") {
                return {
                    counts: {
                        "768p_output_second": outSeconds,
                        ...(inSeconds > 0
                            ? { "768p_input_video_second": inSeconds }
                            : {}),
                    },
                };
            }
            return {
                counts: {
                    "480p_output_second": outSeconds,
                    ...(inSeconds > 0
                        ? { "480p_input_video_second": inSeconds }
                        : {}),
                },
            };
        },
    },
});
