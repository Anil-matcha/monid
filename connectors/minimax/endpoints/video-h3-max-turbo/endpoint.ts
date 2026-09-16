import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zH3MaxTurboVideoBody } from "./schema/inputs.ts";

/**
 * MiniMax-H3-Max-Turbo — the V2 task API, same two hops as Standard H3.
 *
 * The simplest card in the family: one PER_UNIT·SECOND line per
 * resolution, metered on `task.usage.total_seconds`. No reference media
 * (so no input-video line) and no input-image charge (so no image line) —
 * the model bills generated output and nothing else.
 */
export default defineEndpoint({
    meta: {
        displayName: "MiniMax Video (H3 Max Turbo)",
        summary: "Generate the fastest, cheapest H3 video — 5-15s at 480P " +
            "or 768P from a prompt or frame images.",
        description: "Generate video with MiniMax-H3-Max-Turbo from a text " +
            "prompt (text-to-video) or a starting and/or ending frame " +
            "image (image-to-video). Outputs 5 to 15 seconds at 480P or " +
            "768P; reference images, video and audio are not supported on " +
            "this model. Turbo is the fastest tier in the H3 family and " +
            "priced at half of H3-Max, which makes it the right choice for " +
            "drafts, batch exploration and rapid iteration. Text, faces " +
            "and transitions are more prone to artifacts than on H3-Max, " +
            "especially at 480P, so prefer 768P; use MiniMax-H3-Max or " +
            "MiniMax-H3 for final output. Runs asynchronously. Billed per " +
            "second of generated output — $0.025 at 480P, $0.04 at 768P. " +
            "Input materials are not billed. A failed or cancelled task " +
            "costs nothing.",
        docsUrl:
            "https://platform.minimax.io/docs/api-reference/video-generation",
        categories: ["video-generation"],
    },
    endpoint: "/v1/video/minimax-h3-max-turbo",
    request: { method: "POST", path: "/v2/video_generation" },
    input: { schema: { body: zH3MaxTurboVideoBody } },
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
                "480p_second": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.SECOND,
                    consumes: { credit: "default", amount: 0.025 },
                    label: "480P seconds",
                    description: "generated seconds at 480P",
                },
                "768p_second": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.SECOND,
                    consumes: { credit: "default", amount: 0.04 },
                    label: "768P seconds",
                    description: "generated seconds at 768P",
                },
            },
        },
        /** No reference media on this model, so the requested duration IS
         *  the whole quantity. */
        estimate: ({ data }) => {
            const seconds = data.input.body.duration;
            if (data.input.body.resolution === "768P") {
                return { counts: { "768p_second": seconds } };
            }
            return { counts: { "480p_second": seconds } };
        },
        /** `total_seconds` is the basis AND the kill switch — a succeeded
         *  task reporting none bills zero rather than guessing. */
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
            if (data.input.body.resolution === "768P") {
                return { counts: { "768p_second": seconds } };
            }
            return { counts: { "480p_second": seconds } };
        },
    },
});
