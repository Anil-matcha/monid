import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zHailuoVideoBody } from "./schema/inputs.ts";

/**
 * MiniMax Hailuo-2.3 video — the V1 task API: `POST /v1/video_generation`
 * parks a task, `GET /v1/query/video_generation` polls it, and a
 * `GET /v1/files/retrieve` hop turns the finished `file_id` into a
 * download URL. Three upstream hops, one Monid run.
 *
 * PER-CELL BILLING (design D4): MiniMax prices Hailuo per FINISHED VIDEO
 * in three published cells, and those cells are not linear in duration
 * ($0.0467/s at 768P/6s vs $0.056/s at 768P/10s) — so no per-second line
 * can reproduce the card. The doc declares one PER_UNIT·RESULT line per
 * cell and the fns put `1` on whichever the request selects. That is the
 * D19 rule: selection is a COUNTING rule owned by the fns.
 *
 * The REQUEST is also the settlement basis, because the V1 task API
 * reports no usage block at all — v1's `videoActualCost` did exactly the
 * same. A task that fails settles a synthesized 500 and is zero-billed by
 * the engine before evidence ever runs, so the request-basis is only ever
 * read for a video that actually came back.
 *
 * Identity is pinned: the wire path `/v1/video_generation` is transport
 * plumbing shared with nothing else, but the model-named identity is the
 * one v1 published and monid-services already routes.
 */
export default defineEndpoint({
    meta: {
        displayName: "MiniMax Video (Hailuo-2.3)",
        summary: "Generate 6s or 10s video from a prompt or a starting " +
            "frame image, at 768P or 1080P.",
        description: "Generate video with MiniMax-Hailuo-2.3 from a text " +
            "prompt (text-to-video) or from a starting frame image " +
            "(image-to-video, with an optional caption). Supports [camera " +
            "command] syntax in the prompt — [Push in], [Pan left], [Zoom " +
            "out], [Tracking shot] and more — for directed motion. Output " +
            "is 768P at 6 or 10 seconds, or 1080P at 6 seconds only. " +
            "'prompt_optimizer' rewrites the prompt for better adherence " +
            "and 'fast_pretreatment' trades some of that quality for " +
            "speed. Runs asynchronously: the request submits a task, the " +
            "run polls it, and the result is a download URL. Priced per " +
            "finished video by resolution and duration — $0.28 for " +
            "768P/6s, $0.56 for 768P/10s, $0.49 for 1080P/6s. A failed " +
            "task costs nothing.",
        docsUrl:
            "https://platform.minimax.io/docs/api-reference/video-generation",
        categories: ["video-generation"],
    },
    /** PUBLIC identity (design D22): the model-named path v1 published —
     *  the wire path is a shared transport detail. */
    endpoint: "/v1/video/minimax-hailuo-2.3",
    request: { method: "POST", path: "/v1/video_generation" },
    input: {
        schema: {
            // vendor-documented API defaults, applied at the binding (D25).
            // resolution + duration are the PRICE CELL's coordinates, so
            // they must always be readable by the estimate.
            body: zHailuoVideoBody.extend({
                model: zHailuoVideoBody.shape.model.unwrap()
                    .default("MiniMax-Hailuo-2.3"),
                resolution: zHailuoVideoBody.shape.resolution.unwrap()
                    .default("768P"),
                duration: zHailuoVideoBody.shape.duration.unwrap().default(6),
                prompt_optimizer: zHailuoVideoBody.shape.prompt_optimizer
                    .unwrap().default(true),
                fast_pretreatment: zHailuoVideoBody.shape.fast_pretreatment
                    .unwrap().default(false),
            }),
        },
    },
    // v1: requestTimeoutMs 30_000 / runTimeoutMs 600_000 /
    // pollIntervalMs 10_000.
    timeouts: { requestMs: 30_000, runMs: 600_000, pollMs: 10_000 },
    lifecycle: {
        /**
         * OVERRIDES the provider's blocking relay: same envelope check,
         * but a 2xx here parks a task instead of finishing the run.
         */
        start: async ({ utils, logger }) => {
            const res = await utils.request();
            if (res.status < 200 || res.status >= 300) {
                logger.warn("hailuo submit non-2xx — returning as data", {
                    status: res.status,
                });
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            // ONLY `0` is success — an absent or unreadable `base_resp` is
            // a malformed 200 and must not park a task we would bill for
            // (design D3; v1 was permissive here).
            const statusCode = utils.json.optionalNum(
                res.body,
                "$.base_resp.status_code",
            );
            if (statusCode !== 0) {
                logger.warn("hailuo submit envelope error — synthesizing 502", {
                    statusCode: statusCode ?? null,
                });
                return {
                    kind: "COMPLETED",
                    httpStatus: 502,
                    providerHttpStatus: res.status,
                    output: res.body,
                };
            }
            const taskId = utils.json.optionalGet(res.body, "$.task_id");
            if (typeof taskId !== "string" || taskId === "") {
                // 2xx, clean envelope, no task id: a MiniMax contract
                // violation, not a caller error.
                throw new Error("MiniMax video submit returned no task_id");
            }
            return { kind: "RUNNING", state: { externalRunId: taskId } };
        },
        /**
         * Query the task, and on success resolve the file in the same
         * tick (v1 `pollVideoTask`).
         *
         * Non-2xx on either hop settles as DATA (the apify v2 posture),
         * where v1 threw to reach `pollProvider`'s 3-attempt retry budget.
         * That budget has no v2 equivalent inside the fn — a retriable
         * throw would simply spin until `runMs` — so a broken poll hop
         * ends the run honestly and zero-billed instead.
         */
        poll: async ({ data, utils, logger }) => {
            const runId = data.lifecycle.state.externalRunId;
            if (runId === undefined) {
                // corrupted thread state — deterministic, never retriable
                throw Object.assign(
                    new Error("hailuo poll without externalRunId in state"),
                    { retriable: false },
                );
            }
            const query = await utils.http({
                method: "GET",
                path: "/v1/query/video_generation",
                queryParams: { task_id: runId },
            });
            if (query.status < 200 || query.status >= 300) {
                return {
                    kind: "COMPLETED",
                    httpStatus: query.status,
                    output: query.body,
                };
            }
            const status = utils.json.optionalGet(query.body, "$.status");
            if (
                status === "Preparing" || status === "Queueing" ||
                status === "Processing"
            ) {
                // absent state — the previous fn-state carries forward (D21)
                return { kind: "RUNNING" };
            }
            if (status === "Fail") {
                logger.warn("hailuo task failed", { runId });
                return {
                    kind: "COMPLETED",
                    // OURS synthesized (the TASK failed) / THEIRS was a 200
                    httpStatus: 500,
                    providerHttpStatus: query.status,
                    output: query.body,
                };
            }
            if (status !== "Success") {
                // Unknown status on a 2xx — KEEP POLLING rather than
                // settling on a shape we do not recognize. Bounded by
                // runMs. Without this, an unrecognized status would fall
                // into the Success path, find no file_id, and end a
                // still-running task with a synthesized 502 (the H3 polls
                // have always guarded this; v1's Hailuo poll did not).
                logger.warn(
                    "hailuo task status unrecognized — treating as in flight",
                    { runId, status: String(status) },
                );
                return { kind: "RUNNING" };
            }
            // Success — resolve file_id to a download url.
            const fileId = utils.json.optionalGet(query.body, "$.file_id");
            if (typeof fileId !== "string" || fileId === "") {
                logger.warn("hailuo task succeeded without file_id", { runId });
                return {
                    kind: "COMPLETED",
                    httpStatus: 502,
                    providerHttpStatus: query.status,
                    output: query.body,
                };
            }
            const file = await utils.http({
                method: "GET",
                path: "/v1/files/retrieve",
                queryParams: { file_id: fileId },
            });
            if (file.status < 200 || file.status >= 300) {
                return {
                    kind: "COMPLETED",
                    httpStatus: file.status,
                    output: file.body,
                };
            }
            const downloadUrl = utils.json.optionalGet(
                file.body,
                "$.file.download_url",
            );
            if (typeof downloadUrl !== "string" || downloadUrl === "") {
                logger.warn("hailuo file retrieve returned no download_url", {
                    runId,
                    fileId,
                });
                return {
                    kind: "COMPLETED",
                    httpStatus: 502,
                    providerHttpStatus: file.status,
                    output: file.body,
                };
            }
            return {
                kind: "COMPLETED",
                httpStatus: 200,
                output: {
                    task_id: runId,
                    file_id: fileId,
                    download_url: downloadUrl,
                    video_width: utils.json.optionalGet(
                        query.body,
                        "$.video_width",
                    ) ?? null,
                    video_height: utils.json.optionalGet(
                        query.body,
                        "$.video_height",
                    ) ?? null,
                    filename: utils.json.optionalGet(
                        file.body,
                        "$.file.filename",
                    ) ?? null,
                    bytes: utils.json.optionalGet(file.body, "$.file.bytes") ??
                        null,
                },
            };
        },
        // No stop: MiniMax exposes no usable cancel for V1 video tasks
        // (v1 `stoppable: false`).
    },
    usage: {
        /** The three published cells, one PER_UNIT·RESULT line each — a
         *  finished video is the unit, and exactly one line ever counts. */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                "768p_6s": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    consumes: { credit: "default", amount: 0.28 },
                    label: "768P 6s",
                    description: "one finished 768P video of 6 seconds",
                },
                "768p_10s": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    consumes: { credit: "default", amount: 0.56 },
                    label: "768P 10s",
                    description: "one finished 768P video of 10 seconds",
                },
                "1080p_6s": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    consumes: { credit: "default", amount: 0.49 },
                    label: "1080P 6s",
                    description: "one finished 1080P video of 6 seconds",
                },
            },
        },
        /** One video, on the cell the request selects. Both knobs are
         *  defaulted at the binding, so they are always readable here. */
        estimate: ({ data }) => {
            if (data.input.body.resolution === "1080P") {
                return { counts: { "1080p_6s": 1 } };
            }
            if (data.input.body.duration === 10) {
                return { counts: { "768p_10s": 1 } };
            }
            return { counts: { "768p_6s": 1 } };
        },
        /** Same cell at settle: the V1 task API reports no usage block, so
         *  the accepted request IS the billing fact. Only ever reached for
         *  a 2xx — a failed task is zero-billed by the engine. */
        evidence: ({ data }) => {
            if (data.input.body.resolution === "1080P") {
                return { counts: { "1080p_6s": 1 } };
            }
            if (data.input.body.duration === 10) {
                return { counts: { "768p_10s": 1 } };
            }
            return { counts: { "768p_6s": 1 } };
        },
    },
});
