import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zH3FastVideoBody } from "./schema/inputs.ts";

/**
 * MiniMax-H3-Fast — the V2 task API, same two hops as Standard H3.
 *
 * One resolution, so one PER_UNIT·SECOND line, metered on
 * `task.usage.total_seconds` (reference-video input bills at the same
 * $0.046 as output on this model, so one line covers both — the H3
 * arrangement). Input images beyond the first 5 add $0.04 each, netted in
 * `evidence` from the raw `input_image_count` (design D7).
 *
 * The `start` override does one extra thing the other three do not: it
 * injects the upstream-required `style: "style1"` at the wire. The field
 * is absent from the schema because MiniMax describes the two accepted
 * values as interchangeable internal terms — exposing a knob that changes
 * nothing would be noise in the public contract.
 */
export default defineEndpoint({
    meta: {
        displayName: "MiniMax Video (H3 Fast)",
        summary: "Generate budget 5-15s 480P video from a prompt, frame " +
            "images, or reference media.",
        description: "Generate video with MiniMax-H3-Fast from a text " +
            "prompt (text-to-video), from a starting and/or ending frame " +
            "image (image-to-video), or guided by reference images, video " +
            "and audio (reference-to-video), at 480P only, 5 to 15 " +
            "seconds. H3-Fast is a low-cost tier that keeps the full " +
            "multimodal reference surface, but it is slower than H3-Max " +
            "and H3-Max-Turbo and its clarity and detail vary between " +
            "runs — treat it as a niche option to test against a specific " +
            "requirement rather than a default. For speed use " +
            "MiniMax-H3-Max-Turbo; for quality use MiniMax-H3. Runs " +
            "asynchronously. Billed at $0.046 per second of generated " +
            "output, with reference-video input seconds billed at the same " +
            "rate on top. The first 5 input images are free, then $0.04 " +
            "each; reference audio is free. A failed or cancelled task " +
            "costs nothing.",
        docsUrl:
            "https://platform.minimax.io/docs/api-reference/video-generation",
        categories: ["video-generation"],
    },
    endpoint: "/v1/video/minimax-h3-fast",
    request: { method: "POST", path: "/v2/video_generation" },
    input: { schema: { body: zH3FastVideoBody } },
    timeouts: { requestMs: 30_000, runMs: 1_800_000, pollMs: 10_000 },
    lifecycle: {
        /** Same as the other H3 models, plus the pinned `style` — an
         *  upstream requirement with no caller-facing meaning, so it is
         *  injected here rather than exposed in the schema. */
        start: async ({ data, utils, logger }) => {
            const res = await utils.request({
                body: { ...data.input.body, style: "style1" },
            });
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
                "480p_second": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.SECOND,
                    consumes: { credit: "default", amount: 0.046 },
                    label: "480P seconds",
                    description:
                        "generated seconds at 480P, plus reference-video input seconds",
                },
                "input_image": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    consumes: { credit: "default", amount: 0.04 },
                    label: "input images",
                    description:
                        "input images beyond the first 5, which are free",
                },
            },
        },
        estimate: ({ data }) => {
            const items = data.input.body.content;
            const referenceSeconds = items.some((item) =>
                    item.type === "video_url"
                )
                ? 15
                : 0;
            const seconds = data.input.body.duration + referenceSeconds;
            const images = items.filter((item) => item.type === "image_url")
                .length;
            const billable = Math.max(0, images - 5);
            return {
                counts: {
                    "480p_second": seconds,
                    ...(billable > 0 ? { "input_image": billable } : {}),
                },
            };
        },
        evidence: ({ data, utils, logger }) => {
            const total = utils.json.optionalNum(
                data.output,
                "$.task.usage.total_seconds",
            );
            const seconds = total !== undefined && total > 0
                ? Math.floor(total)
                : 0;
            if (seconds === 0) {
                logger.warn(
                    "h3 task succeeded without usage seconds — zero-billing",
                    {},
                );
            }
            const rawImages = utils.json.optionalNum(
                data.output,
                "$.task.usage.input_image_count",
            );
            const images = rawImages !== undefined && rawImages > 0
                ? Math.floor(rawImages)
                : 0;
            const billable = Math.max(0, images - 5);
            return {
                counts: {
                    "480p_second": seconds,
                    ...(billable > 0 ? { "input_image": billable } : {}),
                },
            };
        },
    },
});
