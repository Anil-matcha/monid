import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zH3VideoBody } from "./schema/inputs.ts";

/**
 * MiniMax-H3 (Standard H3) — the V2 task API: `POST /v2/video_generation`
 * parks a task and `GET /v2/query/video_generation/{task_id}` polls it.
 * Two upstream hops, no files/retrieve — V2 returns the result inline.
 *
 * PER-SECOND BILLING (design D4): MiniMax publishes H3 per second of
 * output, per resolution, so the doc declares one PER_UNIT·SECOND line per
 * resolution and the fns put the seconds on whichever one the request
 * selects. H3's reference-video INPUT seconds bill at the SAME rate as its
 * output seconds, so one line per resolution covers both and the basis is
 * `task.usage.total_seconds` — v1's reading exactly. (H3-Max, whose input
 * rate differs, splits its lines instead.)
 *
 * Input images beyond the first 5 add $0.04 each. The netting is computed
 * here from the RAW `task.usage.input_image_count` that already rides the
 * output (design D7) — v1 stamped a derived `billable_input_images` field
 * onto the payload during polling because its price card could only read a
 * field that existed; `evidence` needs no such prop, and leaving the raw
 * count visible keeps the arithmetic checkable by the caller.
 */
export default defineEndpoint({
    meta: {
        displayName: "MiniMax Video (H3)",
        summary: "Generate 4-15s video up to 2K from a prompt, frame " +
            "images, or reference media.",
        description: "Generate video with MiniMax-H3 from a text prompt " +
            "(text-to-video), from a starting and/or ending frame image " +
            "(image-to-video), or guided by reference images, reference " +
            "video and reference audio for consistent characters, motion " +
            "and voice (reference-to-video). Outputs 4 to 15 seconds at " +
            "480P, 768P or 2K in a choice of aspect ratios. Standard H3 is " +
            "the best-quality tier of the H3 family: strongest image " +
            "quality and aesthetics, complex character handling, reference " +
            "fidelity, and direct 2K generation. It is also the slowest " +
            "tier — a 5-second clip takes 2-3 minutes and 15 seconds up to " +
            "9 minutes — and the most expensive. Suited to high-value " +
            "final production; for drafts or high-volume work prefer " +
            "MiniMax-H3-Max or MiniMax-H3-Max-Turbo. Runs asynchronously. " +
            "Billed per second of generated output — $0.038 at 480P, $0.08 " +
            "at 768P, $0.13 at 2K — and reference-video input seconds bill " +
            "at the same per-second rate on top, so a 2K run with a long " +
            "reference clip can reserve several dollars up front. The " +
            "first 5 input images are free, then $0.04 each; reference " +
            "audio is free. A failed or cancelled task costs nothing.",
        docsUrl:
            "https://platform.minimax.io/docs/api-reference/video-generation",
        categories: ["video-generation"],
    },
    /** PUBLIC identity (design D22): four H3 models share ONE wire path,
     *  so each pins its own model-named identity. */
    endpoint: "/v1/video/minimax-h3",
    request: { method: "POST", path: "/v2/video_generation" },
    input: { schema: { body: zH3VideoBody } },
    // v1: requestTimeoutMs 30_000 / runTimeoutMs 1_800_000 /
    // pollIntervalMs 10_000 — a 15s 2K clip can take ~9 minutes.
    timeouts: { requestMs: 30_000, runMs: 1_800_000, pollMs: 10_000 },
    lifecycle: {
        /** OVERRIDES the provider's blocking relay. No `base_resp` check:
         *  the V2 surface answers with real HTTP statuses and an
         *  OpenAI-style error body, so there is no 200-shaped failure. */
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
                // absent state — the previous fn-state carries forward (D21)
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
                    // OURS synthesized (the TASK failed) / THEIRS was a 200
                    httpStatus: 500,
                    providerHttpStatus: res.status,
                    output: res.body,
                };
            }
            if (status !== "succeeded") {
                // Unknown status on a 2xx — KEEP POLLING rather than
                // settling on a shape we do not recognize. Bounded by runMs.
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
        // No stop: upstream cancel is queued-only (v1 `stoppable: false`).
    },
    usage: {
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                "480p_second": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.SECOND,
                    consumes: { credit: "default", amount: 0.038 },
                    label: "480P seconds",
                    description:
                        "generated seconds at 480P, plus reference-video input seconds",
                },
                "768p_second": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.SECOND,
                    consumes: { credit: "default", amount: 0.08 },
                    label: "768P seconds",
                    description:
                        "generated seconds at 768P, plus reference-video input seconds",
                },
                "2k_second": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.SECOND,
                    consumes: { credit: "default", amount: 0.13 },
                    label: "2K seconds",
                    description:
                        "generated seconds at 2K, plus reference-video input seconds",
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
        /** The requested duration is the output promise; a reference video
         *  adds its own billed seconds, held at the upstream 15s cap since
         *  the real clip length is not knowable before the run. */
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
            const imageLine = billable > 0 ? { "input_image": billable } : {};
            if (data.input.body.resolution === "2K") {
                return { counts: { "2k_second": seconds, ...imageLine } };
            }
            if (data.input.body.resolution === "768P") {
                return { counts: { "768p_second": seconds, ...imageLine } };
            }
            return { counts: { "480p_second": seconds, ...imageLine } };
        },
        /** `total_seconds` is the basis AND the kill switch: a succeeded
         *  task reporting none is an anomaly that bills zero rather than
         *  guessing (v1 invariant). `input_image_count` is MiniMax's RAW
         *  submitted count, so the free allowance is netted here. */
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
            const imageLine = billable > 0 ? { "input_image": billable } : {};
            if (data.input.body.resolution === "2K") {
                return { counts: { "2k_second": seconds, ...imageLine } };
            }
            if (data.input.body.resolution === "768P") {
                return { counts: { "768p_second": seconds, ...imageLine } };
            }
            return { counts: { "480p_second": seconds, ...imageLine } };
        },
    },
});
