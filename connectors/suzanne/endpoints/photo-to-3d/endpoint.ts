import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPhotoTo3dBody } from "./schema/inputs.ts";

/**
 * POST /v1/generations/photo-to-3d — 1–4 photos into a 3D mesh.
 *
 * UPLOAD-ONLY (design D7): the vendor's inline base64 channel is mirrored in
 * the schema and REMOVED at this binding. The run input is persisted verbatim
 * into the upstream run record (a 400 KB DynamoDB item); a ≤5 MB base64 photo
 * would fail run creation. `.strict()` turns that into a clear validation
 * issue at the boundary instead of a confusing downstream failure.
 *
 * Otherwise pure data: the async machinery is inherited from the provider.
 */
export default defineEndpoint({
    meta: {
        displayName: "Suzanne Photo-to-3D",
        summary:
            "Generate a production 3D mesh from 1–4 photos (async; polled to completion).",
        description:
            "Generate a production 3D mesh from photos. Choose a model: " +
            "'sculptor' (default) accepts 1–4 views — front required, " +
            "back/left/right optional, and 2–4 views auto-route to " +
            "multi-view reconstruction; 'atelier' is single-photo (front " +
            "only) and always produces premium PBR materials with detailed " +
            "textures. First call the Suzanne uploads endpoint once per " +
            "view to mint a presigned URL, PUT each JPEG/PNG straight to S3, " +
            "then pass the upl_* ids in images_upload_ids. Inline base64 " +
            "photos are not accepted here. Tune polygon count via " +
            "params.faces (200000 / 500000 / 1000000 / 2000000, default " +
            "500000), PBR via params.pbr, quad topology via params.quad, and " +
            "texture fidelity via params.texture_quality; request formats " +
            "via outputs (GLB by default, optional OBJ / STL / FBX). This is " +
            "an async run: the job is polled internally and the run " +
            "completes with the finished job (status plus outputs[] with " +
            "per-format download URLs); typical latency is 30 s–2 min for a " +
            "single image and 1–4 min for multi-view. Fetch the mesh bytes " +
            "with the Suzanne model-download endpoint.",
        docsUrl: "https://console.suzanne3d.com/documentation/photo-to-3d",
        categories: ["3d-generation"],
    },
    request: { method: "POST", path: "/v1/generations/photo-to-3d" },
    input: {
        schema: {
            // the binding derives Monid's surface from the vendor mirror:
            // drop the inline channel, make the remaining one mandatory, and
            // reject anything unmodeled (so `images_inline` fails loudly
            // rather than riding through as an unknown key)
            body: zPhotoTo3dBody
                .omit({ images_inline: true })
                .required({ images_upload_ids: true })
                .strict(),
        },
    },
    // ASYNC generation — see the text-to-3d note (design D9). Multi-view is
    // the slower path (1–4 min documented), so the budget matters more here.
    timeouts: { runMs: 600_000 },
    usage: {
        /** Flat per generation, whatever the view count — the contract rate
         *  Suzanne bills us (v1 `unitPrice`, $0.65). */
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "generation",
            consumes: { credit: "default", amount: 0.65 },
        },
    },
});
