import { z } from "zod";
import { type Json, zJson } from "@shared/core";

/**
 * HTTP fixture: recorded {req, res} pairs served in order during replay.
 * Headers are NEVER recorded — credentials cannot leak into fixtures.
 *
 * FIXTURES ARE MINIMAL SHARED CHAINS (fixture strategy v2): committed DATA
 * files at PROVIDER level (`connectors/<provider>/fixtures/<shape>.json`) —
 * one hand-minimized chain per lifecycle SHAPE (run-succeeded, run-failed,
 * start-rejected, pay-per-event…), each stating what it exercises in
 * `description`. Call urls may carry `{{request.url}}` / `{{request.origin}}`
 * placeholders, bound at replay time from the endpoint's compiled request —
 * so ONE chain serves every endpoint of the provider.
 *
 * Recording heritage (fixture diet, design D11): chains derive from real
 * recordings — requests, order, statuses untouched (replay matches
 * REQUESTS only) — with RESPONSE bodies shrunk by the deterministic
 * `trimJson` pass (arrays capped, long strings truncated) and PII redacted
 * by `scrubJson` (structural placeholders; keys/shape intact). The
 * fixture-size lint (fixture-size.test.ts) bounds files.
 */
/**
 * The ONLY response headers a fixture may carry. Request headers are never
 * recorded (credentials); response headers are a different set, but
 * `set-cookie` and account-identifying ratelimit/tracing headers live there
 * too — so the recorder captures an explicit allowlist and nothing else is
 * kept. Growing it is a deliberate edit in the same PR as the connector that
 * needs it (the categories.ts posture).
 *
 * The allowlist bounds WHICH headers survive; it does not make the survivor
 * safe by itself — a `location` can BE a credential (a presigned URL). That
 * is `scrubUrlCredentials`' job, applied by `scrubCalls` before anything is
 * written.
 */
export const RECORDED_RES_HEADERS = ["location"] as const;

export const zRecordedCall = z.object({
    req: z.object({
        method: z.string(),
        url: z.string(),
        body: zJson.optional(),
    }).strict(),
    res: z.object({
        status: z.number().int(),
        /** ALLOWLISTED response headers — envelope facts a fn reads, e.g. a
         *  302's `location`. Absent on every chain that does not need one.
         *  Keys are CHECKED against the allowlist, not merely typed
         *  `z.string()`: the recorder is not the only way a fixture gets
         *  written, and a hand-edited one carrying `set-cookie` must fail to
         *  load rather than replay. (A refinement rather than
         *  `z.record(z.enum(...))`, which is EXHAUSTIVE — that would demand
         *  every allowlisted key on every fixture the moment the list grows
         *  past one.) */
        headers: z.record(z.string(), z.string())
            .refine(
                (headers) =>
                    Object.keys(headers).every((key) =>
                        (RECORDED_RES_HEADERS as readonly string[]).includes(
                            key,
                        )
                    ),
                {
                    message: `response headers must be one of: ${
                        RECORDED_RES_HEADERS.join(", ")
                    }`,
                },
            )
            .optional(),
        body: zJson,
    }).strict(),
}).strict();
export type RecordedCall = z.infer<typeof zRecordedCall>;

/** The allowlisted subset of a real response's headers, keys lowercased. */
export function pickRecordedHeaders(
    headers: Headers,
): Record<string, string> | undefined {
    const out: Record<string, string> = {};
    for (const name of RECORDED_RES_HEADERS) {
        const value = headers.get(name);
        // lowercase the KEY too, not just the (case-insensitive) lookup: the
        // allowlist is meant to grow, and an entry added as `Retry-After`
        // would otherwise be written verbatim and never match a fn reading
        // `res.headers["retry-after"]`
        if (value !== null) out[name.toLowerCase()] = value;
    }
    return Object.keys(out).length > 0 ? out : undefined;
}

export const zFixture = z.object({
    name: z.string().min(1),
    /** What lifecycle shape this chain exercises — every fixture says why
     *  it exists (fixture strategy v2). */
    description: z.string().min(1),
    calls: z.array(zRecordedCall).min(1),
}).strict();
export type Fixture = z.infer<typeof zFixture>;

export async function loadFixture(path: string): Promise<Fixture> {
    return zFixture.parse(JSON.parse(await Deno.readTextFile(path)));
}

/** Trim bounds — tunable beside the pass, mirrored by the size lint. */
export const TRIM_ARRAY_CAP = 2;
export const TRIM_STRING_CAP = 500;

/**
 * The deterministic trim pass: cap every array to its first
 * TRIM_ARRAY_CAP elements and truncate string leaves beyond
 * TRIM_STRING_CAP chars — recursively, keys and structure untouched.
 * Applied ONLY to recorded RESPONSE bodies (never requests/urls/statuses),
 * so the replayed wire contract is unchanged; only what the engine
 * CONSUMES shrinks (count assertions reflect the trimmed reality).
 */
export function trimJson(value: Json): Json {
    if (typeof value === "string") {
        return value.length > TRIM_STRING_CAP
            ? value.slice(0, TRIM_STRING_CAP)
            : value;
    }
    if (Array.isArray(value)) {
        return value.slice(0, TRIM_ARRAY_CAP).map(trimJson);
    }
    if (value !== null && typeof value === "object") {
        const out: Record<string, Json> = {};
        for (const [key, item] of Object.entries(value)) {
            out[key] = trimJson(item);
        }
        return out;
    }
    return value;
}

/** Apply the trim pass to a recorded call chain (response bodies only). */
export function trimCalls(calls: RecordedCall[]): RecordedCall[] {
    return calls.map((call) => ({
        req: call.req,
        res: { ...call.res, body: trimJson(call.res.body) },
    }));
}

/**
 * The PII scrub pass (fixture strategy v2): value-level redaction on string
 * LEAVES — email-shaped substrings → `user@example.com`, E.164-ish phone
 * substrings → `+15550000000` — recursively, keys and structure untouched.
 * Deliberately conservative (regex leaves, no key heuristics): recordings
 * are for SHAPE, and shape survives redaction. Applied by the recorder
 * after `trimJson`; shared committed chains are additionally hand-checked.
 */
export function scrubJson(value: Json): Json {
    if (typeof value === "string") {
        return value
            .replace(
                /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
                "user@example.com",
            )
            .replace(/\+\d{7,15}/g, "+15550000000");
    }
    if (Array.isArray(value)) return value.map(scrubJson);
    if (value !== null && typeof value === "object") {
        const out: Record<string, Json> = {};
        for (const [key, item] of Object.entries(value)) {
            out[key] = scrubJson(item);
        }
        return out;
    }
    return value;
}

/** The placeholder every redacted query value collapses to. */
export const REDACTED_QUERY_VALUE = "REDACTED";

/**
 * Strip credentials out of a URL-valued header (`location`).
 *
 * A redirect target can BE a bearer credential: a presigned S3 URL carries
 * its authorization in the query string (`X-Amz-Signature`, `Signature`,
 * `token`, …), and recording one verbatim would commit temporary read access
 * to the vendor's object. So every query VALUE collapses to a placeholder
 * while the scheme, host, path and parameter NAMES survive — which is all a
 * fixture needs, since it exists to pin SHAPE.
 *
 * Value-level, not a denylist of known-secret parameter names: a denylist is
 * wrong the first time a vendor signs with a parameter nobody listed.
 *
 * Non-URL values and URLs without a query pass through untouched (a plain
 * trailing-slash 307 `location` is not a secret and stays readable).
 */
export function scrubUrlCredentials(value: string): string {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return value; // not a URL (relative location, junk) — leave it alone
    }
    if ([...url.searchParams.keys()].length === 0) return value;
    for (const key of [...url.searchParams.keys()]) {
        url.searchParams.set(key, REDACTED_QUERY_VALUE);
    }
    return url.toString();
}

/** Scrub over a recorded chain — REQUEST bodies included: request payloads
 *  are exactly where caller-supplied PII lives, and replay matches calls by
 *  method + URL only, so scrubbing the body is replay-safe (PR #2 finding).
 *  The REQUEST URL is deliberately KEPT verbatim — the replay matcher and
 *  the `{{request.url}}` fixture binding depend on it; recorded inputs come
 *  from the curated test-inputs table, which follows the placeholder
 *  identity convention (consented or public-figure names only).
 *
 *  RESPONSE HEADERS get the URL-credential scrub: an allowlisted `location`
 *  may be a presigned (bearer) URL. Replay-safe for the same reason the body
 *  is — matching never reads response headers. */
export function scrubCalls(calls: RecordedCall[]): RecordedCall[] {
    return calls.map((call) => ({
        req: {
            ...call.req,
            ...(call.req.body !== undefined
                ? { body: scrubJson(call.req.body) }
                : {}),
        },
        res: {
            ...call.res,
            ...(call.res.headers !== undefined
                ? {
                    headers: Object.fromEntries(
                        Object.entries(call.res.headers).map((
                            [key, value],
                        ) => [key, scrubUrlCredentials(value)]),
                    ),
                }
                : {}),
            body: scrubJson(call.res.body),
        },
    }));
}

/**
 * Serve recorded calls in order; fail loudly on mismatch or exhaustion.
 * `bindings` substitute `{{key}}` placeholders in recorded urls before
 * compare (e.g. `{{request.url}}` → the endpoint's compiled request url) —
 * how one shared chain serves every endpoint of a provider.
 */
export function replayFetch(
    fixture: Fixture,
    bindings: Record<string, string> = {},
): typeof fetch {
    const bind = (template: string): string =>
        template.replace(
            /\{\{([A-Za-z_][\w.-]*)\}\}/g,
            (whole, key: string) => bindings[key] ?? whole,
        );
    let index = 0;
    return (
        input: URL | RequestInfo,
        init?: RequestInit,
    ): Promise<Response> => {
        const url = typeof input === "string"
            ? input
            : input instanceof URL
            ? input.href
            : input.url;
        const method = init?.method ?? "GET";
        const call = fixture.calls[index];
        if (!call) {
            return Promise.reject(
                new Error(
                    `replay(${fixture.name}): no recorded call left for ${method} ${url}`,
                ),
            );
        }
        const expectedUrl = bind(call.req.url);
        if (call.req.method !== method || expectedUrl !== url) {
            return Promise.reject(
                new Error(
                    `replay(${fixture.name}): call ${index} expected ${call.req.method} ${expectedUrl}, ` +
                        `engine issued ${method} ${url}`,
                ),
            );
        }
        index++;
        return Promise.resolve(
            // a recorded 3xx replays WITH its allowlisted headers — the
            // engine's transport is `redirect: "manual"`, so a Response
            // carrying a `location` is exactly what the live exchange was
            new Response(JSON.stringify(call.res.body), {
                status: call.res.status,
                headers: {
                    "content-type": "application/json",
                    ...call.res.headers,
                },
            }),
        );
    };
}

/** Wrap a real fetch, capturing {req, res} pairs. REQUEST headers are never
 *  recorded (credentials); RESPONSE headers are captured only on the
 *  RECORDED_RES_HEADERS allowlist — and re-attached to the response relayed
 *  onward, so the recording run and its later replay observe the SAME
 *  exchange (without this, a recorded `location` would be in the fixture but
 *  missing from the live run that produced it). */
export function recordingFetch(
    realFetch: typeof fetch,
    sink: RecordedCall[],
): typeof fetch {
    return async (
        input: URL | RequestInfo,
        init?: RequestInit,
    ): Promise<Response> => {
        const url = typeof input === "string"
            ? input
            : input instanceof URL
            ? input.href
            : input.url;
        const method = init?.method ?? "GET";
        const requestBody = typeof init?.body === "string"
            ? parseMaybeJson(init.body)
            : undefined;
        const response = await realFetch(input, init);
        const text = await response.text();
        const headers = pickRecordedHeaders(response.headers);
        sink.push({
            req: {
                method,
                url,
                ...(requestBody !== undefined ? { body: requestBody } : {}),
            },
            res: {
                status: response.status,
                ...(headers !== undefined ? { headers } : {}),
                body: parseMaybeJson(text) ?? text,
            },
        });
        return new Response(text, {
            status: response.status,
            headers: {
                "content-type": response.headers.get("content-type") ??
                    "application/json",
                ...headers,
            },
        });
    };
}

function parseMaybeJson(text: string): Json | undefined {
    try {
        return JSON.parse(text) as Json;
    } catch {
        return undefined;
    }
}
