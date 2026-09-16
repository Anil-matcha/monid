import { defineEndpoint, type Json, UsageModelKind } from "@shared/core";
import { zDownloadPathParams, zDownloadQueryParams } from "./schema/inputs.ts";

/**
 * GET /v1/models/{job_id}/download — a fresh presigned URL for a finished
 * job's mesh.
 *
 * Suzanne answers `302 Found` with an EMPTY body and the 15-minute presigned
 * S3 URL in the `Location` header: the payload rides the envelope, not the
 * body. The engine never follows redirects (a credential must not travel to a
 * foreign origin) and, since 0.2.0, hands fns the response headers — so this
 * `start` reads `location` and shapes it as `{download_url}`. That URL needs
 * no credential, so the caller fetches the bytes directly.
 *
 * SYNC + FREE: fetching an already-paid result costs nothing.
 */
export default defineEndpoint({
    meta: {
        displayName: "Suzanne Model Download",
        summary:
            "Get a fresh 15-minute presigned download URL for a finished job's mesh.",
        description:
            "Get a fresh, short-lived (15-minute) presigned download URL for " +
            "a completed Suzanne job's mesh in the requested format. The " +
            "format must have been listed in the job's outputs when it was " +
            "submitted. Poll the generation run to completion first — a job " +
            "that has not finished answers 409 job_not_done. Returns " +
            "{ download_url }; GET that URL with no credential to retrieve " +
            "the mesh file. The URL is unguessable but not private — treat " +
            "it like any S3 link, and re-request this endpoint to mint a " +
            "fresh one whenever it expires or leaks. Free: the generation " +
            "was already paid for.",
        docsUrl: "https://console.suzanne3d.com/documentation/download-model",
        categories: ["3d-generation"],
    },
    /** PUBLIC identity: `zEndpointPath` admits no braces, so the placeholder
     *  path cannot be its own id — pinned brace-free (design D5). */
    endpoint: "/v1/models/download",
    request: { method: "GET", path: "/v1/models/{job_id}/download" },
    input: {
        schema: {
            pathParams: zDownloadPathParams,
            queryParams: zDownloadQueryParams,
        },
    },
    lifecycle: {
        /**
         * Behavior is driven by the STATUS, never a URL string:
         *   - 3xx with a readable `location` → that IS the success: OURS 200
         *     / THEIRS the 302 (design D12), body `{download_url}`.
         *   - 3xx without one (opaque redirect) → the vendor's status stands
         *     and the run reads as a provider error: visible, never silent
         *     corruption.
         *   - anything else (200 JSON, 404 not_found, 409 job_not_done) →
         *     relayed verbatim.
         */
        start: async ({ utils, logger }) => {
            const res = await utils.request();
            const location = res.headers.location;
            const redirected = res.status >= 300 && res.status < 400;
            if (redirected && location !== undefined && location !== "") {
                return {
                    kind: "COMPLETED",
                    httpStatus: 200,
                    providerHttpStatus: res.status,
                    output: { download_url: location },
                };
            }
            if (redirected) {
                logger.warn("suzanne redirect without a readable Location", {
                    status: res.status,
                });
            }
            // annotated: TS normalizes a union of object literals by adding
            // `?: undefined` siblings, which are not assignable to Json
            const output: Json = redirected
                ? { message: "Redirect missing Location header" }
                : res.body;
            return {
                kind: "COMPLETED",
                httpStatus: res.status,
                output,
            };
        },
    },
    usage: {
        /** FREE — fetching the already-paid result never bills (v1 priced it
         *  at $0, which is the same fact spelled as a rate). */
        model: { kind: UsageModelKind.FREE },
    },
});
