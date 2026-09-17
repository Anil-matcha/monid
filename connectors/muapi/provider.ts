import { defineProvider, presets } from "@shared/core";

/**
 * MuAPI — a unified AI media API. The provider keeps the transport protocol
 * in one place: submit a model-specific generation request, then poll the
 * prediction result until it completes. Endpoint files describe the model
 * surface and its rate card.
 *
 * MuAPI's result envelope carries the actual USD charge in `cost`. That is a
 * vendor meter, not presentation data, so consolidate lifts it out before
 * the output projection. The endpoint's static rate card remains the
 * estimate and derived-fold cross-check for the dynamic vendor price.
 */
export default defineProvider({
    name: "muapi",
    meta: {
        displayName: "MuAPI",
        summary:
            "Unified AI video generation across current image and video models.",
        description:
            "Unified AI video generation through one API: send a prompt to a " +
            "model-specific endpoint, then poll the request until the finished " +
            "video URL is available. The first connector surface exposes " +
            "Seedance 2.5 text-to-video with 480p through 4K output, 4-30 " +
            "second clips, aspect-ratio control and reproducible seeds. MuAPI " +
            "returns the actual generation charge in its result envelope; " +
            "failed tasks are settled without usage.",
        homepageUrl: "https://muapi.ai",
        docsUrl: "https://muapi.ai/docs/video-generation",
        categories: ["video-generation"],
        notes: [
            "Video generation is asynchronous: the initial request only " +
            "creates a prediction, and the connector polls it internally " +
            "until MuAPI reports completion.",
            "Completed video URLs are delivered by MuAPI and may be temporary; " +
            "download or copy the result promptly.",
            "MuAPI pricing is dynamic by model and generation settings. The " +
            "connector's estimate is based on the published Seedance 2.5 " +
            "resolution/second card, while the response cost is the final " +
            "vendor charge.",
        ],
    },
    auth: { inject: presets.auth.header("x-api-key") },
    request: { baseUrl: "https://api.muapi.ai/api/v1" },
    timeouts: { requestMs: 30_000, runMs: 1_800_000, pollMs: 10_000 },
    lifecycle: {
        start: async ({ utils, logger }) => {
            const res = await utils.request();
            if (res.status < 200 || res.status >= 300) {
                logger.warn("muapi submit returned non-2xx", {
                    status: res.status,
                });
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }

            const requestId = utils.json.optionalGet(
                res.body,
                "$.request_id",
            );
            if (typeof requestId !== "string" || requestId === "") {
                throw Object.assign(
                    new Error("MuAPI submit returned no request_id"),
                    { retriable: false },
                );
            }
            return { kind: "RUNNING", state: { externalRunId: requestId } };
        },
        poll: async ({ data, utils, logger }) => {
            const requestId = data.lifecycle.state.externalRunId;
            if (requestId === undefined) {
                throw Object.assign(
                    new Error("muapi poll without externalRunId in state"),
                    { retriable: false },
                );
            }

            const res = await utils.http({
                method: "GET",
                path: "/predictions/" + encodeURIComponent(requestId) +
                    "/result",
            });
            if (res.status < 200 || res.status >= 300) {
                // A poll transport failure may hide a generation that is
                // still running and billable, so let the engine retry it.
                throw new Error(
                    "MuAPI prediction query returned " + String(res.status),
                );
            }

            const status = utils.json.optionalGet(res.body, "$.status");
            if (status === "queued" || status === "processing") {
                return { kind: "RUNNING" };
            }
            if (
                status === "failed" || status === "cancelled" ||
                status === "expired"
            ) {
                logger.warn("muapi prediction reached a terminal failure", {
                    requestId,
                    status,
                });
                return {
                    kind: "COMPLETED",
                    httpStatus: 500,
                    providerHttpStatus: res.status,
                    output: res.body,
                };
            }
            if (status !== "completed") {
                // MuAPI can add intermediate states without making an
                // in-flight request a successful result. Unknown 2xx states
                // stay in the bounded poll loop.
                logger.warn("muapi prediction status is unrecognized", {
                    requestId,
                    status: String(status),
                });
                return { kind: "RUNNING" };
            }

            // The documented result uses outputs[0]. The catalogued API
            // schema has also represented the same artifact as output.video;
            // accept both without changing the raw response returned to the
            // caller.
            const videoUrl = utils.json.optionalGet(
                res.body,
                "$.outputs[0]",
            ) ?? utils.json.optionalGet(res.body, "$.output.video") ??
                utils.json.optionalGet(res.body, "$.output");
            if (typeof videoUrl !== "string" || videoUrl === "") {
                logger.warn("muapi completed without a video URL", {
                    requestId,
                });
                return {
                    kind: "COMPLETED",
                    httpStatus: 502,
                    providerHttpStatus: res.status,
                    output: res.body,
                };
            }
            return {
                kind: "COMPLETED",
                httpStatus: 200,
                providerHttpStatus: res.status,
                output: res.body,
            };
        },
    },
    output: {
        fromError: ({ data, utils }) => {
            const nested = utils.json.optionalGet(
                data.output,
                "$.error.message",
            );
            const direct = utils.json.optionalGet(data.output, "$.error");
            const flat = utils.json.optionalGet(data.output, "$.message");
            const code = utils.json.optionalGet(
                data.output,
                "$.error.code",
            );
            const message = typeof nested === "string" && nested !== ""
                ? nested
                : typeof direct === "string" && direct !== ""
                ? direct
                : typeof flat === "string" && flat !== ""
                ? flat
                : "MuAPI API error";
            return {
                message,
                ...(typeof code === "string" ? { code } : {}),
                raw: data.output,
            };
        },
    },
    usage: {
        credits: { default: { label: "US dollars" } },
        consolidate: ({ data, utils }) => {
            const { value, rest } = utils.json.pluck(data.output, "$.cost");
            const amount = value === undefined
                ? undefined
                : utils.json.optionalNum(value, "$.amount_usd");
            return {
                credits: {
                    ...(amount !== undefined ? { default: amount } : {}),
                },
                output: rest,
            };
        },
    },
});
