import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zAgentBody } from "./schema/inputs.ts";

/**
 * `POST /v2/agent` — autonomous multi-page research into structured JSON.
 *
 * Same job protocol as `/crawl` and `/batch/scrape` (submit -> poll -> cancel,
 * the status URL being the submit URL plus the id), so the lifecycle fns here
 * are BYTE-IDENTICAL to theirs and intern to one shared fnTable entry per
 * phase. The agent's terminal body carries `data` as a single OBJECT rather
 * than an array and is never paginated, which the shared poll already handles:
 * a non-array `data` short-circuits the `next` walk and returns the envelope
 * untouched.
 *
 * BILLING: this is the one endpoint Firecrawl prices DYNAMICALLY — it
 * publishes no formula, only the `maxCredits` ceiling the caller sets and the
 * `creditsUsed` the run reports. So the model meters in CREDIT units at 1
 * credit each: the estimate promises the ceiling the vendor itself enforces,
 * and the settle reports what was actually drawn. Derived and claimed agree by
 * construction here — which is the honest reading of a vendor that publishes
 * no rate, rather than inventing one to disagree with.
 *
 * `maxCredits` is REQUIRED at the binding: the vendor's own default is a
 * silent 2,500, and an estimate has to promise a bounded number before the run
 * holds credit.
 */
export default defineEndpoint({
    meta: {
        displayName: "Firecrawl Agent",
        summary: "Autonomous multi-page web research into structured JSON.",
        description: "Describe the data you want in natural language and an " +
            "autonomous agent browses, navigates, and extracts it into JSON " +
            "— optionally shaped by your `schema` and constrained to given " +
            "`urls`. Use it when the pages holding the answer are unknown or " +
            "spread across a site; use a plain scrape when you already know " +
            "the one URL. Pricing is dynamic with a hard ceiling you set via " +
            "`maxCredits`, which is required here: the run settles at what " +
            "the research actually consumed, never above the ceiling. Runs " +
            "take minutes and are polled until the extraction completes.",
        docsUrl: "https://docs.firecrawl.dev/api-reference/endpoint/agent",
        categories: ["web-scraping"],
    },
    request: { method: "POST", path: "/agent" },
    input: {
        schema: {
            // PRIMARY limiting knob — required even though the vendor
            // publishes a default (2,500), so the estimate is deduced from
            // the caller's own stated ceiling rather than a constant (D25).
            body: zAgentBody.required({ maxCredits: true }),
        },
    },
    timeouts: { requestMs: 30_000, runMs: 900_000, pollMs: 10_000 },
    lifecycle: {
        start: async ({ data, utils, logger }) => {
            logger.info("submitting firecrawl job", { url: data.request.url });
            const res = await utils.request();
            if (res.status < 200 || res.status >= 300) {
                // Firecrawl API error (402 payment required, 429 rate limit,
                // 400 bad input) — DATA, zero-billed by the engine.
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            const jobId = utils.json.optionalGet(res.body, "$.id");
            if (typeof jobId !== "string" || jobId === "") {
                // 2xx without a job id: the vendor promised a job we cannot
                // manage — infrastructure failure, not data.
                throw new Error("Firecrawl did not return a job id");
            }
            return { kind: "RUNNING", state: { externalRunId: jobId } };
        },
        poll: async ({ data, utils, logger }) => {
            const jobId = data.lifecycle.state.externalRunId;
            if (jobId === undefined) {
                throw Object.assign(
                    new Error("firecrawl poll without externalRunId in state"),
                    { retriable: false },
                );
            }
            const statusUrl = data.request.url + "/" +
                encodeURIComponent(jobId);
            const res = await utils.http({ method: "GET", url: statusUrl });
            if (
                res.status === 408 || res.status === 429 ||
                res.status === 500 || res.status === 502 ||
                res.status === 503 || res.status === 504
            ) {
                // The status LOOKUP failed, not the job. Firecrawl documents
                // exactly these six as retryable, and the job keeps running —
                // and keeps charging, since crawl and batch pages bill as they
                // complete — so declaring the RUN terminal here would abandon
                // a live job whose cost we would then absorb. RUNNING is also
                // the honest answer: we could not determine the job state.
                // `utils.http` exposes no headers, so `Retry-After` cannot be
                // honored; back the cadence off instead. Bounded by runMs.
                logger.warn("firecrawl status lookup transient", {
                    jobId,
                    status: res.status,
                });
                return { kind: "RUNNING", pollAfterMs: 30_000 };
            }
            if (res.status < 200 || res.status >= 300) {
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            const status = utils.json.optionalGet(res.body, "$.status");
            if (
                status === undefined || status === "scraping" ||
                status === "processing"
            ) {
                // still working — absent state carries the previous one
                // forward (design D21)
                return { kind: "RUNNING" };
            }
            if (status !== "completed") {
                // vendor-side job failure (failed / cancelled) surfaces as an
                // OURS-synthesized error status while providerHttpStatus keeps
                // the real 200 the status API answered with (design D12)
                const message = utils.json.optionalGet(res.body, "$.error");
                logger.warn("firecrawl job did not complete", {
                    jobId,
                    status: String(status),
                });
                return {
                    kind: "COMPLETED",
                    httpStatus: 500,
                    providerHttpStatus: 200,
                    output: {
                        status,
                        message: typeof message === "string" && message !== ""
                            ? message
                            : "Firecrawl job " + String(status),
                    },
                };
            }
            // COMPLETED: hand the vendor's envelope back as it came, `next`
            // intact. We do NOT walk the chain. Firecrawl caps a response at
            // 10 MB and chunks a large job's results deliberately; stitching
            // them would put an unbounded payload through a single run, and a
            // failure mid-walk would ship a PARTIAL set as a success while
            // `completed` still billed the whole job. The caller pages with
            // firecrawl#crawl/{id} / firecrawl#batch/scrape/{id}, which are
            // FREE (reading a job consumes no credits).
            //
            // `id` is the ONE addition to the vendor's shape, and it is what
            // makes those endpoints callable: the status body does not carry
            // the job id (only the submit response does) and `next` needs a
            // credential the caller never holds. Same spelling the submit
            // response uses, so a future vendor `id` field is a no-op merge.
            return {
                kind: "COMPLETED",
                httpStatus: 200,
                output: utils.json.merge(res.body, { id: jobId }),
            };
        },
        stop: async ({ data, utils, logger }) => {
            const jobId = data.lifecycle.state.externalRunId;
            if (jobId === undefined) {
                throw Object.assign(
                    new Error("firecrawl stop without externalRunId in state"),
                    { retriable: false },
                );
            }
            const res = await utils.http({
                method: "DELETE",
                url: data.request.url + "/" + encodeURIComponent(jobId),
            });
            if (res.status < 200 || res.status >= 300) {
                // best-effort teardown: an already-finished job answers
                // non-2xx and there is nothing left to stop
                logger.warn("firecrawl job cancel failed (ignored)", {
                    jobId,
                    status: res.status,
                });
            }
        },
    },
    usage: {
        /** Dynamic pricing with no published formula: the vendor's own credit
         *  draw IS the quantity, metered one-for-one (design D26 — akta's
         *  reviews endpoints take the same posture, where credits are the
         *  vendor's native meter and no block quantity exists to settle
         *  against). */
        model: {
            kind: UsageModelKind.PER_UNIT,
            unit: Unit.CREDIT,
            label: "agent credits",
            description: "credits the agent's research consumed, bounded by " +
                "the `maxCredits` ceiling on the request",
            consumes: { credit: "default", amount: 1 },
        },
        /** The ceiling the vendor itself enforces — the only bound that
         *  exists before the run. */
        estimate: ({ data }) => ({
            counts: { "CREDIT": data.input.body.maxCredits },
        }),
        /** What the run actually drew. The provider consolidate reads the
         *  same field as the vendor's claim, so the two agree by construction
         *  and the mismatch signal stays quiet — correct for a vendor that
         *  publishes no rate to disagree with. */
        evidence: ({ data, utils }) => ({
            counts: {
                "CREDIT":
                    utils.json.optionalNum(data.output, "$.creditsUsed") ?? 0,
            },
        }),
    },
});
