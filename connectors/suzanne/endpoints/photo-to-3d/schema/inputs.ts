import { z } from "zod";
import {
    zModel,
    zOutputs,
    zParams,
    zUploadId,
} from "../../../schema/common.ts";

/**
 * `POST /v1/generations/photo-to-3d` request body — the faithful vendor
 * mirror (design D25/D7). The vendor documents TWO image channels, "pick
 * exactly one", so BOTH are mirrored here; the endpoint binding then removes
 * `images_inline` and requires `images_upload_ids`. Mirroring a channel we do
 * not offer is the point: the mirror describes the VENDOR, the binding
 * describes what Monid exposes.
 *
 * Flat object, NOT a discriminated union on `model`: the per-model
 * constraints (atelier takes a single front view) are documented in the field
 * text and enforced server-side — a union plus the `z.preprocess` v1 used to
 * default the discriminator is not reliably JSON-Schema representable, and
 * `.omit()` does not exist on a union.
 */
export const zPhotoTo3dBody = z.object({
    model: zModel.optional(),
    images_upload_ids: z.object({
        front: zUploadId.describe("Front view. Required."),
        back: zUploadId.describe("Back view. sculptor only.").optional(),
        left: zUploadId.describe("Left view. sculptor only.").optional(),
        right: zUploadId.describe("Right view. sculptor only.").optional(),
    }).describe(
        "Uploaded views, by upload id. 1 view → single-image reconstruction; " +
            "2–4 → multi-view (auto-routed). atelier accepts the front view " +
            "only. Get upl_* ids from the Suzanne uploads endpoint.",
    ).optional(),
    images_inline: z.object({
        front: z.string().describe("Base64-encoded JPEG or PNG."),
    }).describe(
        "Inline base64 photo, single view only (≤ ~5 MB). NOT accepted by " +
            "this connector — use images_upload_ids.",
    ).optional(),
    params: zParams.optional(),
    outputs: zOutputs.optional(),
});
