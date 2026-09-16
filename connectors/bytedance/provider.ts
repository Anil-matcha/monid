import { defineProvider, presets } from "@shared/core";

/**
 * ByteDance — BytePlus ModelArk ("Ark"), ported from monid-services
 * `adaptors/bytedance/*`.
 *
 * ByteDance is the PLATFORM: one credential, one base URL, one async task API
 * hosting multiple model families. Seedance (video) is the family live today —
 * one endpoint per model (design D1), because the models differ in CAPABILITY,
 * not only price.
 *
 * The whole Ark task lifecycle lives ONCE here (submit → poll), so every
 * endpoint reduces to data: meta + notes + the create-task request + its input
 * schema + its rate card. Ported 1:1 from v1's `runLifecycle`:
 *   - start: POST the create-task request. An Ark API error (non-2xx) is DATA
 *     (COMPLETED, zero-billed by the engine); a 2xx without a task id is an Ark
 *     contract violation (deterministic throw); else park with the task id as
 *     `externalRunId`.
 *   - poll: GET the task. A non-2xx on OUR GET THROWS (design D7) — the task is
 *     very likely still running, and BytePlus bills for the generation whether
 *     or not we keep asking, so abandoning it as a provider error would hand
 *     the caller an error for a video we paid for. Terminal task failures DO
 *     settle: failed/cancelled/expired synthesize 500, succeeded-without-a-url
 *     synthesizes 502, both zero-billed.
 *   - no stop: Ark's cancel applies only to `queued` tasks, so v1 declares
 *     `stoppable: false`. We do not advertise what we cannot honor.
 *
 * NO `lifecycle.state` schema: nothing needs the fn-owned `data` bag. The task
 * id rides the first-class `externalRunId` and the task status rides `stage`.
 * v1 had to stash the billing tier there; v2's evidence fn reads the REQUEST
 * instead (design D4), which is both authoritative and immune to the poll-echo
 * drift that silently zeroed v1's cost accounting for weeks.
 *
 * NOTE (idempotency): Ark documents no Idempotency-Key, so the submit is not
 * deduplicated — a host-side retry of the start tick could double-submit.
 * Carried over from v1 as a known gap.
 */
export default defineProvider({
    name: "bytedance",
    meta: {
        displayName: "ByteDance",
        summary:
            "AI video generation on BytePlus ModelArk with the ByteDance Seedance models.",
        description:
            "AI video generation on BytePlus ModelArk with the ByteDance " +
            "Seedance family — create videos from a text prompt, animate a " +
            "still image, or remix reference images, video, and audio, with " +
            "synchronized sound. Per-model limits (durations, resolutions, " +
            "reference budgets) are declared on each endpoint.",
        homepageUrl: "https://byteplus.com",
        docsUrl: "https://docs.byteplus.com/en/docs/ModelArk",
        categories: ["video-generation"],
        /** Caveats true of EVERY Seedance model. Endpoint notes concatenate
         *  after these (add-meta-notes D1), so a model only states what
         *  diverges. */
        notes: [
            "Generation takes tens of seconds to minutes — these endpoints " +
            "are asynchronous; poll the run rather than blocking on it.",
            "The completed run returns a video_url that EXPIRES in about 24 " +
            "hours — download it promptly.",
            "Reference URLs must be public https:// URLs — Ark fetches them " +
            "server-side, so the target has to be reachable.",
            "Reference images and videos containing real human faces are " +
            "rejected upstream.",
            "Reference-video runs have upstream minimum-token floors, and " +
            "bill at the vendor's separate reference-video rate; the " +
            "returned usage reflects both automatically.",
            "Content rules that the published JSON Schema cannot express, " +
            "and that Ark enforces itself: at most one first_frame and one " +
            "last_frame image, a last_frame requires a first_frame in the " +
            "same request, and a request that pins either frame must use " +
            'ratio "adaptive" (the output inherits the frame\'s aspect ' +
            "ratio).",
        ],
    },
    auth: { inject: presets.auth.bearer() },
    request: {
        baseUrl: "https://ark.ap-southeast.bytepluses.com",
        headers: { Accept: "application/json" },
    },
    // mirrors v1 endpoints/video-generation/endpoint.ts `timeouts` (design
    // D10): 60s per HTTP call (30s sat right on a latency cliff and killed
    // submits that would have succeeded), 30min per run (2.5's 30-second
    // outputs run well past 15 minutes), poll every 60s.
    timeouts: { requestMs: 60_000, runMs: 1_800_000, pollMs: 60_000 },
    lifecycle: {
        start: async ({ utils, logger }) => {
            // the DEFAULT RELAY: method/url/headers from the compiled request,
            // body from the caller input AFTER input.toRequest — so the pinned
            // model id and the duration sentinel are already in place (D8)
            const res = await utils.request();
            if (res.status < 200 || res.status >= 300) {
                // Ark API error (bad reference URL, model not open, quota) —
                // no task was created, so nothing will be billed: DATA.
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            const taskId = utils.json.optionalGet(res.body, "$.id");
            if (typeof taskId !== "string" || taskId === "") {
                // 2xx with no id: Ark violated its own contract. Deterministic
                // — retrying cannot fix it.
                throw Object.assign(
                    new Error("ByteDance submit returned no task id"),
                    { retriable: false },
                );
            }
            logger.debug("ark generation task submitted", { taskId });
            return { kind: "RUNNING", state: { externalRunId: taskId } };
        },
        poll: async ({ data, utils, logger }) => {
            const runId = data.lifecycle.state.externalRunId;
            if (runId === undefined) {
                // corrupted thread state — deterministic, never retriable
                throw Object.assign(
                    new Error("bytedance poll without externalRunId in state"),
                    { retriable: false },
                );
            }
            const res = await utils.http({
                method: "GET",
                path: "/api/v3/contents/generations/tasks/" +
                    encodeURIComponent(runId),
            });
            if (res.status < 200 || res.status >= 300) {
                // design D7: OUR poll GET failed while the task is very likely
                // still generating — and billing. Throw (retriable) rather
                // than settle, so a transient Ark blip does not abandon a
                // video we are paying for.
                throw new Error(
                    "ByteDance task query returned " + String(res.status),
                );
            }
            const task = res.body;
            const status = utils.json.optionalGet(task, "$.status");
            if (status === "queued" || status === "running") {
                return {
                    kind: "RUNNING",
                    state: { externalRunId: runId, stage: status },
                };
            }
            if (
                status === "failed" || status === "cancelled" ||
                status === "expired"
            ) {
                logger.warn("ark task reached a terminal failure", {
                    runId,
                    status,
                });
                return {
                    kind: "COMPLETED",
                    // OURS synthesized (the TASK failed) / THEIRS was a 200
                    // (the poll exchange itself succeeded) — design D12
                    httpStatus: 500,
                    providerHttpStatus: res.status,
                    output: task,
                };
            }
            // succeeded → the result rides on content.video_url
            const videoUrl = utils.json.optionalGet(
                task,
                "$.content.video_url",
            );
            if (typeof videoUrl !== "string" || videoUrl === "") {
                logger.warn("ark task succeeded without content.video_url", {
                    runId,
                });
                return {
                    kind: "COMPLETED",
                    httpStatus: 502,
                    providerHttpStatus: res.status,
                    output: task,
                };
            }
            return {
                kind: "COMPLETED",
                httpStatus: 200,
                providerHttpStatus: res.status,
                output: task,
            };
        },
        // no stop — Ark cancel is queued-only (v1 `stoppable: false`)
    },
    output: {
        // THE error-digestion hook (design D12). Ark submit failures return a
        // pure `{error: {code, message, param, type}}` envelope, which buries
        // the message one level deeper than anyone looks; terminal task bodies
        // carry the same `error` object alongside id/status. One reader covers
        // both, and the raw body is kept under `raw` (digest, never hide).
        fromError: ({ data, utils }) => {
            const nested = utils.json.optionalGet(
                data.output,
                "$.error.message",
            );
            const flat = utils.json.optionalGet(data.output, "$.message");
            const code = utils.json.optionalGet(data.output, "$.error.code");
            const message = typeof nested === "string"
                ? nested
                : typeof flat === "string"
                ? flat
                : "ByteDance API error";
            return {
                message,
                ...(typeof code === "string" ? { code } : {}),
                raw: data.output,
            };
        },
    },
    usage: {
        /** THE credit system (design D26): BytePlus publishes its Seedance
         *  rate card directly in US dollars per 1M tokens, so the pool IS
         *  dollars — the same posture as apify. Every endpoint's model pins
         *  its published per-line $ draws; the $/credit conversion and any
         *  markup are the broker card's job, not the connector's. */
        credits: { default: { label: "US dollars" } },
        /** The vendor reports NO monetary total — Ark's `usage` block is raw
         *  token COUNTS, which the evidence fns already read. So the claim is
         *  always empty (the derived fold settles) and this fn's whole job is
         *  the D27 strip: billing facts never ride the payload. `pluck`, not
         *  `omit` — the removal is exactly `$.usage`, not a deep key-walk.
         *  The count stays public as `usage.evidence`, keyed by the rate line
         *  that priced it. */
        consolidate: ({ data, utils }) => ({
            credits: {},
            output: utils.json.pluck(data.output, "$.usage").rest,
        }),
        // No provider-level model/estimate/evidence: every endpoint has ≥2
        // metered lines (resolution × reference-video tier), so the compiler
        // requires DOC-level fns anyway — a generic provider fn could not know
        // which line a count belongs to (design D3).
    },
});
