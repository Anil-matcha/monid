import { defineProvider, presets } from "@shared/core";

/**
 * Suzanne (api.suzanne3d.com) — text and photos into production 3D meshes.
 * The first MIXED-MODE provider in the catalog: two asynchronous generation
 * endpoints polled to completion, two synchronous utilities.
 *
 * LIFECYCLE PLACEMENT (design D3): `resolve()` only falls BACK — a
 * provider-level `lifecycle.start` reaches every endpoint and there is no
 * opt-out leaf. So the provider states the ASYNC default (the D27 subclassing
 * rule applied to lifecycle) and the two utilities override `start`:
 *
 *   - `start` (here)  = the generation submit. Ported 1:1 from monid-services
 *     `adaptors/suzanne/endpoints/common.ts#makeGenerationStart`, including
 *     its contract check: a 2xx WITHOUT a `job_id` is a Suzanne contract
 *     violation and THROWS — never a billed success on an empty answer.
 *   - `poll` (here)   = `GET /v1/jobs/{job_id}`, shared by both generations
 *     (v1 `pollSuzanneJob`). queued|running → RUNNING; done → the job body;
 *     failed|cancelled → a synthesized 500 carrying the job's OWN error.
 *   - `uploads` / `model-download` override `start` with their sync fns.
 *
 * Consequence, eyes open: the two sync docs also resolve this `poll` and so
 * carry `timeouts.pollMs`. It is inert — their `start` always returns
 * COMPLETED — and one unused fn ref beats weakening the contract check on a
 * paid endpoint.
 *
 * No `lifecycle.state` schema: the only fact threaded between ticks is
 * `externalRunId`, an engine-owned field of `zFnState`, not the `data` bag.
 * Apify needs the bag because its pricing signals ride the run record;
 * Suzanne's meter rides the job body the poll already returns.
 */
export default defineProvider({
    name: "suzanne",
    meta: {
        displayName: "Suzanne",
        summary:
            "Turn text and photos into production 3D meshes — game-ready GLB/OBJ/STL/FBX output.",
        description:
            "Generate production 3D meshes from a text prompt or from 1–4 " +
            "photos. Two named models: 'sculptor' for game-ready meshes and " +
            "fast iteration, 'atelier' for premium fidelity with PBR " +
            "materials and detailed textures. Tune polygon count, PBR " +
            "textures, quad topology and texture quality per job; request " +
            "GLB, OBJ, STL and FBX outputs. Generation is asynchronous — the " +
            "job is polled internally and the run completes with the " +
            "finished job; typical latency is 30 s–2 min for single-image " +
            "and 1–4 min for multi-view. Photos are supplied by presigned " +
            "upload, and the finished mesh is fetched through a short-lived " +
            "presigned download URL.",
        homepageUrl: "https://suzanne3d.com",
        docsUrl: "https://console.suzanne3d.com/documentation",
        categories: ["3d-generation"],
    },
    auth: { inject: presets.auth.bearer() },
    request: { baseUrl: "https://api.suzanne3d.com" },
    // The provider default is the SYNC budget (uploads / model-download);
    // the two generation endpoints override runMs. pollMs 10 s matches the
    // vendor's own guidance ("poll every 5–10 s").
    timeouts: { requestMs: 30_000, runMs: 60_000, pollMs: 10_000 },
    lifecycle: {
        start: async ({ data, utils, logger }) => {
            // the DEFAULT RELAY: method/url/headers from the compiled
            // request, body from the caller input
            const res = await utils.request();
            if (res.status < 200 || res.status >= 300) {
                // a non-2xx submit never started a job — terminal
                // error-as-data (the engine zero-bills it)
                logger.warn("suzanne generation submit non-2xx", {
                    url: data.request.url,
                    status: res.status,
                });
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            const jobId = utils.json.optionalGet(res.body, "$.job_id");
            if (typeof jobId !== "string" || jobId === "") {
                // 2xx without a job id: Suzanne contract violation → infra.
                // Settling this as a success would bill a generation that
                // never started.
                throw new Error("Suzanne submit returned no job_id");
            }
            return {
                kind: "RUNNING",
                // the vendor's job id IS the correlation handle hosts read
                // (↔ v1 providerRunId)
                state: { externalRunId: jobId },
            };
        },
        poll: async ({ data, utils, logger }) => {
            // typed own-state read (D24): a missing job id is corrupted
            // thread state — deterministic, never retriable
            const jobId = data.lifecycle.state.externalRunId;
            if (jobId === undefined) {
                throw Object.assign(
                    new Error("suzanne poll without externalRunId in state"),
                    { retriable: false },
                );
            }
            const res = await utils.http({
                method: "GET",
                path: "/v1/jobs/" + encodeURIComponent(jobId),
            });
            if (res.status < 200 || res.status >= 300) {
                // Suzanne API error during polling (404 not_found, 401) — DATA
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            const status = utils.json.optionalGet(res.body, "$.status");
            if (status === "queued" || status === "running") {
                // absent state — the previous fn-state carries forward (D21)
                return { kind: "RUNNING" };
            }
            if (status === "done") {
                return {
                    kind: "COMPLETED",
                    httpStatus: 200,
                    output: res.body,
                };
            }
            // failed | cancelled — the JOB failed, the poll exchange did not:
            // OURS synthesized 500 / THEIRS 200 (design D12). The engine
            // zero-bills it, matching the vendor: a vendor_model_error is
            // refunded, and so is a cancellation that lands in time.
            const error = utils.json.optionalGet(res.body, "$.error");
            logger.warn("suzanne job did not succeed", {
                jobId,
                status: typeof status === "string" ? status : null,
            });
            return {
                kind: "COMPLETED",
                httpStatus: 500,
                providerHttpStatus: 200,
                // the job carries its OWN {code, message} — surface it so the
                // real reason reaches the caller
                output: error !== undefined && error !== null ? error : {
                    message: "Suzanne job " +
                        (typeof status === "string" && status !== ""
                            ? status
                            : "failed"),
                },
            };
        },
    },
    output: {
        // THE error-digestion hook (design D12): ONE provider-level
        // projection over the TWO shapes Suzanne answers with — the API's
        // nested envelope (`{error: {type, code, message, request_id}}`) and
        // the job's own flat error object (`{code, message}`, lifted out of
        // the job body by poll). Runs only on provider-error envelopes,
        // after zero-usage forcing. `request_id` is carried deliberately:
        // the vendor asks for it in every support request. The raw body
        // rides under `raw` — digest, never hide.
        fromError: ({ data, utils }) => {
            const nested = utils.json.optionalGet(
                data.output,
                "$.error.message",
            );
            const flat = utils.json.optionalGet(data.output, "$.message");
            const code = utils.json.optionalGet(data.output, "$.error.code") ??
                utils.json.optionalGet(data.output, "$.code");
            const type = utils.json.optionalGet(data.output, "$.error.type");
            const requestId = utils.json.optionalGet(
                data.output,
                "$.error.request_id",
            );
            const message = typeof nested === "string"
                ? nested
                : typeof flat === "string"
                ? flat
                : "Suzanne API error";
            return {
                message,
                ...(typeof code === "string" ? { code } : {}),
                ...(typeof type === "string" ? { type } : {}),
                ...(typeof requestId === "string"
                    ? { request_id: requestId }
                    : {}),
                raw: data.output,
            };
        },
    },
    usage: {
        /** THE credit system (design D26): Suzanne prices per call, in US
         *  dollars, per account — there is no published rate sheet and no
         *  tier-independent pool unit, so the pool IS dollars and every
         *  endpoint's model pins its contract draw. One pool ⇒ id `default`.
         *  The markup v1 carried (and its $0.80 user-facing price) is NOT
         *  here: pools are the vendor's own units, the rate card is the
         *  broker's job. */
        credits: { default: { label: "US dollars" } },
        // No provider-level model: each endpoint declares its own draw.
        // No estimate/evidence either — every model is PER_CALL or FREE, so
        // the compiler synthesizes the one lawful `() => ({counts: {}})`.
    },
});
