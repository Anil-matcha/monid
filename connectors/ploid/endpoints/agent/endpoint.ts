import { z } from "zod";
import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zPloidAgentBody } from "./schema/inputs.ts";

/**
 * `POST /v1/agent` — Ploid's model-led people-research agent, the ONE
 * async doc of the provider (D1): the vendor answers 202
 * `{data: {run_id, status, poll_url}}` and the result comes from
 * `GET /v1/agent/runs/{id}` once `status` leaves queued/running. A
 * terminal failure can arrive as HTTP 200 with a top-level `error` whose
 * `http_status` carries the semantic status (v1 decision 6).
 *
 * Billing: the ACU meter verbatim — `meta.acu_used` on the completed body
 * (whole ACU observed; a fractional meter would pass through).
 */
export default defineEndpoint({
    meta: {
        displayName: "Run Research Agent",
        summary:
            "Run a model-led people research task with a hard compute ceiling.",
        description: "Hand a research goal to a hosted agent that searches " +
            "a live people index and the public web, resolves identities, " +
            "verifies company facts, and synthesizes an evidence-backed " +
            "answer. Returns the synthesis text, typed tool artifacts " +
            "(searches, enrichments, page reads), and optionally a " +
            "structured_output validated against a caller-supplied " +
            "output_schema. Supports a max_acu compute ceiling (billing is " +
            "the compute actually used, never the ceiling) and Markdown " +
            "output. Deep tasks run for minutes (the run is polled). " +
            "Suited for account research, buyer mapping, lookalike " +
            "discovery, and any multi-step question one search cannot " +
            "answer.",
        docsUrl: "https://ploid.com/documentation/api/agent",
        categories: ["agents"],
    },
    request: { method: "POST", path: "/v1/agent" },
    input: {
        // `max_acu` carries the VENDOR default (2, OpenAPI 2.0.0) so the
        // estimate reads one typed number (design D25). v1 exposed a
        // dollar `max_spend_usd` and converted; the vendor's own unit is
        // kept here (owner 2026-09-15, D2).
        schema: {
            body: zPloidAgentBody.extend({
                max_acu: zPloidAgentBody.shape.max_acu.unwrap().default(2),
            }),
        },
        /** Shared-workspace state pinned OFF on the wire (v1
         *  PINNED_AGENT_FIELDS): every run is a fresh `ask` with no memory
         *  and the two public sources; `session_id` cannot arrive (strict
         *  schema). */
        toRequest: ({ data, utils }) => ({
            ...data.input,
            body: utils.json.merge(data.input.body ?? {}, {
                operation: "ask",
                memory: "none",
                sources: ["people", "public_web"],
            }),
        }),
    },
    lifecycle: {
        /** The vendor's poll target, as it told us (`data.poll_url`). */
        state: z.strictObject({ pollPath: z.string().min(1).optional() }),
        /** 2xx + queued/running → RUNNING with the run id; 2xx + top-level
         *  `error` → the failure's own `http_status` (fallback 502) over
         *  providerHttpStatus 200 (ours/theirs, design D12); non-2xx →
         *  data. v1 lineage: startAgent + terminal(). */
        start: async ({ utils }) => {
            const res = await utils.request();
            if (res.status < 200 || res.status >= 300) {
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            const status = utils.json.optionalGet(res.body, "$.data.status");
            const runId = utils.json.optionalGet(res.body, "$.data.run_id");
            const pollUrl = utils.json.optionalGet(res.body, "$.data.poll_url");
            if (
                (status === "queued" || status === "running") &&
                typeof runId === "string" && runId !== ""
            ) {
                return {
                    kind: "RUNNING",
                    state: {
                        externalRunId: runId,
                        ...(typeof pollUrl === "string" && pollUrl !== ""
                            ? { data: { pollPath: pollUrl } }
                            : {}),
                    },
                };
            }
            const failure = utils.json.optionalGet(res.body, "$.error");
            if (typeof failure === "object" && failure !== null) {
                const code = utils.json.optionalNum(
                    res.body,
                    "$.error.http_status",
                );
                return {
                    kind: "COMPLETED",
                    httpStatus: code !== undefined && code >= 400 && code <= 599
                        ? code
                        : 502,
                    providerHttpStatus: res.status,
                    output: res.body,
                };
            }
            return {
                kind: "COMPLETED",
                httpStatus: res.status,
                output: res.body,
            };
        },
        /** queued/running keeps polling (state carries forward, D21);
         *  every other answer is terminal — the completed body, a 2xx
         *  `error` envelope under its own status, or the vendor's
         *  404/409/410/503. v1 lineage: pollAgent + terminal(). */
        poll: async ({ data, utils }) => {
            const runId = data.lifecycle.state.externalRunId;
            if (runId === undefined) {
                throw Object.assign(
                    new Error("ploid poll without externalRunId in state"),
                    { retriable: false },
                );
            }
            const path = data.lifecycle.state.data?.pollPath ??
                "/v1/agent/runs/" + encodeURIComponent(runId);
            const res = await utils.http({ method: "GET", path });
            if (res.status < 200 || res.status >= 300) {
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            const status = utils.json.optionalGet(res.body, "$.data.status");
            if (status === "queued" || status === "running") {
                return { kind: "RUNNING" };
            }
            const failure = utils.json.optionalGet(res.body, "$.error");
            if (typeof failure === "object" && failure !== null) {
                const code = utils.json.optionalNum(
                    res.body,
                    "$.error.http_status",
                );
                return {
                    kind: "COMPLETED",
                    httpStatus: code !== undefined && code >= 400 && code <= 599
                        ? code
                        : 502,
                    providerHttpStatus: res.status,
                    output: res.body,
                };
            }
            return {
                kind: "COMPLETED",
                httpStatus: res.status,
                output: res.body,
            };
        },
    },
    usage: {
        /** 1 ACU of compute = 1 ACU from the pool — v1
         *  makePerResultPrice(ploidAcu(1)), billedUnits = the meter
         *  verbatim. The unit is CREDIT: the vendor's own denomination is
         *  what is counted. */
        model: {
            kind: UsageModelKind.PER_UNIT,
            unit: Unit.CREDIT,
            label: "ACU",
            consumes: { credit: "default", amount: 1 },
            description:
                "agent compute actually used, in ACU (1 ACU = USD 0.10)",
        },
        /** The caller's ceiling IS the worst case (v1 held `max_acu`) —
         *  typed read of the defaulted knob (design D25). */
        estimate: ({ data }) => ({
            counts: { "CREDIT": data.input.body.max_acu },
        }),
        /** Settle counts the meter on the completed body (v1 readAcuUsed;
         *  0 when absent). The provider consolidate then lifts the same
         *  number as the vendor claim. */
        evidence: ({ data, utils }) => ({
            counts: {
                "CREDIT":
                    utils.json.optionalNum(data.output, "$.meta.acu_used") ??
                        0,
            },
        }),
    },
    // Deep research runs for minutes upstream (billed while running) —
    // v1 def timeouts: run 600s, poll 5s (drill 2026-09-05: 15s to done).
    timeouts: { requestMs: 60_000, runMs: 600_000, pollMs: 5_000 },
});
