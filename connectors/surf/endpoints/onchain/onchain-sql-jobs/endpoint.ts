import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zOnchainSqlJobsBody } from "./schema/inputs.ts";

/**
 * POST /onchain/sql/jobs — Heavy tier, 4 Surf credits per SUBMIT; the durable
 * SQL job is polled to completion inside this doc (design D3).
 */
export default defineEndpoint({
    meta: {
        displayName: "Asynchronous Blockchain SQL Job",
        summary: "Run a read-only ClickHouse SQL query as a durable " +
            "background job — for queries too heavy for the 30s " +
            "synchronous window.",
        description: "Run a read-only ClickHouse SQL query as a durable " +
            "background job — use this when /onchain/sql answers " +
            "408, or up front for scans you expect to exceed its 30s " +
            "window. The run stays RUNNING while the job is queued " +
            "or executing (sync and async executions share one " +
            "per-tenant concurrency budget, so a queued job may " +
            "wait) and completes with the full result rows (max " +
            "10000, max_rows). Rules (server-enforced or " +
            "query-killing): SELECT/WITH only (read-only); table " +
            "references must be database-qualified as agent.<table>; " +
            "ALWAYS filter on block_date or block_number (partition " +
            "key — without it the query times out); compare address " +
            "columns directly against lowercase literals (wrapping " +
            "the column in lower() is rejected); never filter on " +
            "symbol columns (unindexed full scan, and symbol matches " +
            "surface scam clones — resolve a ticker to a contract " +
            "address with /search/token first); on transfer tables " +
            "use separate UNION ALL branches instead of OR across " +
            "from/to; use single quotes for strings, e.g. " +
            "toDate('2026-04-07'). Timestamps in results are Unix " +
            "seconds. Estimate cost/validity first with " +
            "/onchain/sql/preflight. Refresh: ~24h.",
        categories: ["onchain-data"],
    },
    request: { method: "POST", path: "/onchain/sql/jobs" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            body: zOnchainSqlJobsBody.extend({
                max_rows: zOnchainSqlJobsBody.shape.max_rows.unwrap().default(
                    1000,
                ),
            }),
        },
    },
    /** The ONE async doc in the connector (design D3): v1's
     *  start / poll / stop `runLifecycle`, endpoint-level because 104 of
     *  105 docs are synchronous relays. Polls and result downloads are FREE
     *  (v1 measured 2026-08-04: 3 submits + 21 polls + 5 downloads deducted
     *  exactly 12 credits), so the flat 4-credit PER_CALL line is the whole
     *  bill. The three job reads (GET / DELETE jobs/{id}, GET results) are
     *  NOT catalog endpoints — the id here is always OUR submit's. */
    lifecycle: {
        start: async ({ data, utils, logger }) => {
            // the DEFAULT RELAY: POST the compiled request with the caller's
            // body. v1 sent an Idempotency-Key derived from the pipeline run
            // id; a hook fn has no run id, so a host-side retry of this tick
            // may submit twice (Surf also dedups on normalized SQL while a
            // retained job exists — upstream behavior, not relied on).
            const res = await utils.request();
            if (res.status < 200 || res.status >= 300) {
                // 429 queue capacity, 400 non-SELECT, 402 vendor balance: no
                // job was created — terminal error-as-data, zero-billed
                logger.warn("surf sql job submit non-2xx", {
                    url: data.request.url,
                    status: res.status,
                });
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            const jobId = utils.json.optionalGet(res.body, "$.data.job_id");
            if (typeof jobId !== "string" || jobId === "") {
                // 2xx without a job id: Surf contract violation (v1 threw
                // EXECUTION_FAILED, non-retriable). Settling it would bill 4
                // credits for a job that never started.
                throw Object.assign(
                    new Error("Surf did not return a SQL job id"),
                    { retriable: false },
                );
            }
            return {
                kind: "RUNNING",
                // the vendor's job id IS the correlation handle (↔ v1
                // providerRunId)
                state: { externalRunId: jobId },
            };
        },
        poll: async ({ data, utils, logger }) => {
            // typed own-state read (D24): a missing job id is corrupted
            // thread state — deterministic, never retriable
            const jobId = data.lifecycle.state.externalRunId;
            if (jobId === undefined) {
                throw Object.assign(
                    new Error("surf poll without externalRunId in state"),
                    { retriable: false },
                );
            }
            // `path` resolves against the ORIGIN, so the /gateway/v1 prefix
            // the baseUrl carries is written back here (clay D6)
            const jobPath = "/gateway/v1/onchain/sql/jobs/" +
                encodeURIComponent(jobId);
            const res = await utils.http({ method: "GET", path: jobPath });
            if (res.status < 200 || res.status >= 300) {
                // a poll-side API error (e.g. the 24h retention lapsed) is
                // terminal error-as-data: the job may still finish upstream
                // but can no longer be observed, and polls are free (v1
                // posture, design D3)
                logger.warn("surf sql job poll non-2xx", {
                    jobId,
                    status: res.status,
                });
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            const status = utils.json.optionalGet(res.body, "$.data.status");
            if (typeof status !== "string" || status === "") {
                // a 2xx job record without a status is a contract violation
                // (v1 threw EXECUTION_FAILED, non-retriable)
                throw Object.assign(
                    new Error("Surf SQL job answered with no status"),
                    { retriable: false },
                );
            }
            if (status === "queued" || status === "running") {
                // absent state — the previous fn-state carries forward (D21)
                return { kind: "RUNNING" };
            }
            if (status === "succeeded") {
                // fetch the retained rows INSIDE the same tick (apify's
                // dataset-fetch pattern) so they ride the terminal snapshot
                const results = await utils.http({
                    method: "GET",
                    path: jobPath + "/results",
                });
                if (results.status < 200 || results.status >= 300) {
                    // the job SUCCEEDED but its result is unreadable: an
                    // observation failure on our side of the seam, not
                    // provider data — the run fails (v1 parity)
                    throw new Error(
                        "Surf SQL results fetch returned " +
                            String(results.status),
                    );
                }
                return {
                    kind: "COMPLETED",
                    httpStatus: 200,
                    // THEIRS — upstream answered 2xx; the 200 is OURS
                    providerHttpStatus: results.status,
                    output: results.body,
                };
            }
            if (status === "failed" || status === "canceled") {
                // the JOB failed, the poll exchange did not: OURS 500 /
                // THEIRS 200 (design D12). The engine zero-bills it; the 4
                // credits Surf took for the submit are not refunded and not
                // recorded (design D3, eyes open).
                const error = utils.json.optionalGet(res.body, "$.data.error");
                logger.warn("surf sql job did not succeed", { jobId, status });
                return {
                    kind: "COMPLETED",
                    httpStatus: 500,
                    providerHttpStatus: res.status,
                    output: {
                        message: "Surf SQL job " + status,
                        status,
                        ...(error !== undefined && error !== null
                            ? { error }
                            : {}),
                    },
                };
            }
            // a 2xx with a status this doc does not know: keep polling and
            // let runMs bound it — never fall into the success branch
            // (minimax D7a)
            logger.warn("surf sql job unknown status, still polling", {
                jobId,
                status,
            });
            return { kind: "RUNNING" };
        },
        stop: async ({ data, utils, logger }) => {
            // best-effort DELETE so a torn-down run (caller stop, runMs)
            // also asks Surf to cancel; cancelling an already-terminal job
            // returns its terminal state, which is fine. The engine swallows
            // any throw — cleanup never masks the run outcome.
            const jobId = data.lifecycle.state.externalRunId;
            if (jobId === undefined) {
                throw Object.assign(
                    new Error("surf stop without externalRunId in state"),
                    { retriable: false },
                );
            }
            const res = await utils.http({
                method: "DELETE",
                path: "/gateway/v1/onchain/sql/jobs/" +
                    encodeURIComponent(jobId),
            });
            if (res.status < 200 || res.status >= 300) {
                logger.warn("surf sql job cancel failed (best-effort)", {
                    jobId,
                    status: res.status,
                });
            }
        },
    },
    // v1 endpointExecution overrides for the job: 60 s per request, 300 s
    // for the run (a queued job waits on Surf's per-tenant concurrency
    // budget; results are retained 24 h upstream but 5 min is the useful
    // interactive bound), poll every 3 s (free).
    timeouts: { requestMs: 60_000, runMs: 300_000, pollMs: 3_000 },
    usage: {
        // Surf's published Heavy tier — v1 makePerCallPrice(surfCredits(4)),
        // the balance-differencing drills of 2026-08 (design D1)
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "call",
            consumes: { credit: "default", amount: 4 },
        },
    },
});
