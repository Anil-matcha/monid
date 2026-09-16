import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zMuapiSeedance25VideoBody } from "./schema/inputs.ts";

/**
 * MuAPI Seedance 2.5 text-to-video.
 *
 * MuAPI publishes a single model-specific POST path and a common prediction
 * result path. Its current public estimator is linear in requested seconds
 * and resolution, so the endpoint can expose a transparent per-second rate
 * card while the provider's `cost.amount_usd` claim settles dynamic changes.
 */
export default defineEndpoint({
    meta: {
        displayName: "MuAPI Seedance 2.5 Text-to-Video",
        summary:
            "Generate a 4-30 second video from a text prompt at 480p through 4K.",
        description:
            "Generate a cinematic video from a detailed text prompt with " +
            "MuAPI's Seedance 2.5 model. Choose 480p, 720p, 1080p or 4K, " +
            "control the clip length from 4 to 30 seconds, select an aspect " +
            "ratio, and optionally provide a reproducible seed or high-bitrate " +
            "output. The request is asynchronous and completes with a video " +
            "URL. MuAPI's public estimator currently prices the model at " +
            "$0.17/$0.34/$0.85/$1.70 per second for 480p/720p/1080p/4K; the " +
            "result envelope's actual USD cost is authoritative when settings " +
            "or vendor pricing change.",
        docsUrl: "https://muapi.ai/playground/seedance-2.5-text-to-video/api",
        categories: ["video-generation"],
    },
    request: {
        method: "POST",
        path: "/seedance-2.5-text-to-video",
    },
    input: {
        schema: {
            body: zMuapiSeedance25VideoBody.extend({
                resolution: zMuapiSeedance25VideoBody.shape.resolution.unwrap()
                    .default("720p"),
                duration: zMuapiSeedance25VideoBody.shape.duration.unwrap()
                    .default(5),
                aspect_ratio: zMuapiSeedance25VideoBody.shape.aspect_ratio
                    .unwrap().default("16:9"),
                high_bitrate: zMuapiSeedance25VideoBody.shape.high_bitrate
                    .unwrap().default(false),
            }),
        },
    },
    usage: {
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                "480p_second": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.SECOND,
                    consumes: { credit: "default", amount: 0.17 },
                    label: "480p seconds",
                    description: "generated seconds at 480p",
                },
                "720p_second": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.SECOND,
                    consumes: { credit: "default", amount: 0.34 },
                    label: "720p seconds",
                    description: "generated seconds at 720p",
                },
                "1080p_second": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.SECOND,
                    consumes: { credit: "default", amount: 0.85 },
                    label: "1080p seconds",
                    description: "generated seconds at 1080p",
                },
                "4k_second": {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.SECOND,
                    consumes: { credit: "default", amount: 1.7 },
                    label: "4K seconds",
                    description: "generated seconds at 4K",
                },
            },
        },
        /** Request settings are the only stable pre-run basis: the public
         * estimator prices duration × resolution, while the vendor result
         * supplies the final USD claim at settle. */
        estimate: ({ data }) => {
            const { resolution, duration } = data.input.body;
            const key = resolution === "480p"
                ? "480p_second"
                : resolution === "1080p"
                ? "1080p_second"
                : resolution === "4k"
                ? "4k_second"
                : "720p_second";
            return { counts: { [key]: duration } };
        },
        /** MuAPI's completion envelope does not promise a generated-duration
         *  field, but the accepted request duration is the estimator's
         *  documented billing basis. The provider claim cross-checks the
         *  resulting fold against the actual vendor amount. */
        evidence: ({ data }) => {
            const { resolution, duration } = data.input.body;
            const key = resolution === "480p"
                ? "480p_second"
                : resolution === "1080p"
                ? "1080p_second"
                : resolution === "4k"
                ? "4k_second"
                : "720p_second";
            return { counts: { [key]: duration } };
        },
    },
});
