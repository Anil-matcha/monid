import type {
    EndpointDoc,
    FnEntry,
    FnRef,
    HttpMethod,
    Json,
    JsonSchemaDoc,
    RunCompleted,
    RunInput,
    RunPollResult,
    RunResult,
    RunStartResult,
    RunState,
    Usage,
} from "@shared/core";
import type { Logger } from "@shared/logging";

/**
 * The engine's PUBLIC INTERFACE — monid-services `interfaces/` +
 * implementation pattern. Hosts (the CLI, the test runner, the hosted
 * Temporal worker) code against these shapes, never against the classes.
 */

/** The transport contract. Auth is UNEXECUTED here: the inject fn ref + its
 *  entry travel with the request so any injector (directTransport locally,
 *  the hosted Relay) can verify + run it self-contained. The engine pipeline
 *  never sees credentials. */
export interface PreparedRequest {
    method: HttpMethod;
    /** Absolute, pathParams already substituted. */
    url: string;
    headers: Record<string, string>;
    /** Multimap: `["v"]` is one value; `["a","b"]` is a REPEATED key
     *  (`?k=a&k=b`), appended in order. A list a connector joined for its
     *  vendor (akta, comma) arrives as the single element `["a,b"]`. */
    query: Record<string, string[]>;
    body?: Json;
    /** ABSENT ⇒ the request egresses BARE (no credential injection) — the
     *  same-origin credential rule (design D16): lifecycle fns targeting a
     *  different origin than the doc's request never carry the provider's
     *  credentials. */
    auth?: {
        inject: { ref: FnRef; entry: FnEntry };
        credentials: JsonSchemaDoc;
    };
    /** Credential lookup key (provider name). */
    provider: string;
    timeouts: { requestMs: number };
}

export interface TransportResponse {
    status: number;
    body: string;
    contentType?: string;
}

/** The only IO port of the engine. Owns credential injection + egress. */
export interface Transport {
    execute(req: PreparedRequest): Promise<TransportResponse>;
}

export type ParamsResolver = (
    provider: string,
) => Promise<Record<string, string>>;

export interface EngineCtx {
    /** The only IO port — owns credential injection + egress. */
    transport: Transport;
    now?: () => Date;
    /** Injectable sleeper for `run()`'s poll loop (tests replay instantly);
     *  default = real setTimeout. Never used by start/poll/stop. */
    sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
    logger?: Logger;
}

/** Result shapes live in @shared/core (schema/run/result.ts — zod-first,
 *  flat, kind-discriminated; they cross process boundaries by value).
 *  Re-exported here so hosts import the engine interface in one place. */
export type { RunCompleted, RunPollResult, RunResult, RunStartResult };

/** Load side: sealed unit in, runnable endpoint out (fail-closed gates). */
export interface ConnectorEngine {
    load(unitJson: unknown): Promise<RunnableEndpoint>;
}

/**
 * Execution side: Temporal-activity-shaped (start/poll/stop stateless,
 * strict-JSON in/out, no sleeps) + the OSS `run()` loop (the only sleeper).
 *
 * poll/stop take the caller's runInput ALONGSIDE the threaded state: the
 * input is re-derived deterministically (validate + input.toRequest) so
 * lifecycle fns see the same input on every tick — hosts (Temporal
 * activities) have the payload by value anyway. `stop` is best-effort and
 * idempotent: without a lifecycle.stop it resolves immediately; with one it
 * runs the fn and swallows EVERY failure (cleanup never masks the outcome).
 */
export interface RunnableEndpoint {
    readonly doc: EndpointDoc;
    /** Pre-run cost estimate — PURE (no IO, no state): validated input →
     *  estimated Usage in consolidate's units. Absent usage.estimate on
     *  the doc ⇒ one CALL unit. */
    estimate(runInput: RunInput): Usage;
    start(runInput: RunInput): Promise<RunStartResult>;
    poll(runInput: RunInput, state: RunState): Promise<RunPollResult>;
    stop(runInput: RunInput, state: RunState): Promise<void>;
    run(
        runInput: RunInput,
        opts?: { signal?: AbortSignal },
    ): Promise<RunCompleted>;
}
