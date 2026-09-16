import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zImageGenerationBody } from "./schema/inputs.ts";

/**
 * MiniMax Image — `POST /v1/image_generation`, one blocking call.
 *
 * Plain per-result metering: a LEAF PER_UNIT doc at the published
 * $0.0035 per generated image, independent of mode and model.
 *
 * The estimate holds the requested `n`; the settle counts what actually
 * came back. That difference is the content-safety rule in one line —
 * MiniMax omits blocked images from the response array, so they are never
 * charged, and no special case is needed to express it.
 */
export default defineEndpoint({
    meta: {
        displayName: "MiniMax Image",
        summary: "Generate images from a text prompt, or from a reference " +
            "portrait for a consistent character.",
        description: "Generate 1-9 images per call from a text prompt " +
            "(text-to-image) or from a single front-facing portrait " +
            "(image-to-image), keeping the same character across " +
            "generations. 'model' selects image-01 — text-to-image and " +
            "image-to-image, and the only model for which width/height " +
            "apply — or image-01-live, which is image-to-image only and " +
            "requires 'subject_reference'. Control framing with " +
            "'aspect_ratio' (1:1 through 21:9, which takes priority over " +
            "width/height), reproducibility with 'seed', and quality with " +
            "'prompt_optimizer'. 'response_format' returns either CDN URLs " +
            "that EXPIRE after 24 hours or inline base64 that does not. " +
            "Charged $0.0035 per image actually returned — images blocked " +
            "for content safety are omitted from the response and cost " +
            "nothing.",
        docsUrl:
            "https://platform.minimax.io/docs/api-reference/image-generation",
        categories: ["image-generation"],
    },
    request: { method: "POST", path: "/v1/image_generation" },
    input: {
        schema: {
            // vendor-documented API defaults, applied at the binding (D25).
            // `n` in particular: it is the estimate's whole basis, and
            // MiniMax's own default is 1.
            body: zImageGenerationBody.extend({
                model: zImageGenerationBody.shape.model.unwrap()
                    .default("image-01"),
                aspect_ratio: zImageGenerationBody.shape.aspect_ratio.unwrap()
                    .default("1:1"),
                response_format: zImageGenerationBody.shape.response_format
                    .unwrap().default("url"),
                n: zImageGenerationBody.shape.n.unwrap().default(1),
                prompt_optimizer: zImageGenerationBody.shape.prompt_optimizer
                    .unwrap().default(false),
            }),
        },
    },
    usage: {
        /** $0.0035 per generated image — published, `image-01`, and the
         *  same for image-01-live (v1: "independent of mode or model"). */
        model: {
            kind: UsageModelKind.PER_UNIT,
            unit: Unit.RESULT,
            label: "images",
            description: "images actually returned",
            consumes: { credit: "default", amount: 0.0035 },
        },
        /** The caller-stated `n` IS the image promise (typed read of the
         *  pre-toRequest validated input — design D25). */
        estimate: ({ data }) => ({
            counts: { "RESULT": data.input.body.n },
        }),
        /** Count what came back, not what was asked for: MiniMax returns
         *  `data.image_urls` for response_format "url" and
         *  `data.image_base64` for "base64", and omits images blocked for
         *  content safety from either — so the array length IS the
         *  billable count, and a fully blocked run bills nothing. */
        evidence: ({ data, utils }) => {
            const urls = utils.json.optionalLen(
                data.output,
                "$.data.image_urls",
            );
            const b64 = utils.json.optionalLen(
                data.output,
                "$.data.image_base64",
            );
            return { counts: { "RESULT": urls ?? b64 ?? 0 } };
        },
    },
});
