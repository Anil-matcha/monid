import type { Json } from "@shared/core";
import { applyAuth, credentialsEnvVarFor, envVarFor } from "./auth.ts";
import { EngineError, EngineErrorCode } from "./errors.ts";
import type {
    ParamsResolver,
    PreparedRequest,
    Transport,
    TransportResponse,
} from "./interfaces/mod.ts";

/**
 * Sniffing decode — the universal body rule (no per-endpoint flag): JSON if
 * it parses, else the COMPLETE raw body as a faithful string (a string IS
 * Json). Shared by the pipeline and utils.http; vendor error pages are
 * already flagged by the HTTP status (isProviderError / the fn's choice).
 */
export function sniffDecode(response: TransportResponse): Json {
    const text = response.body;
    if (text.trim() === "") return null;
    try {
        return JSON.parse(text) as Json;
    } catch {
        return text;
    }
}

/**
 * Default resolver, two conventions:
 *   - `<NAME>_CREDENTIALS` — a JSON object holding the doc's WHOLE
 *     credential params (providers whose `auth.credentials` is not the
 *     default `{apiKey}`: contactout's two keys). Wins when set.
 *   - `<NAME>_API_KEY` → `{ apiKey }` (the v1 convention).
 * The resolver only READS; the injector validates the result against the
 * doc's credentials schema (MISSING_CREDENTIAL on a mismatch).
 */
export const envParamsResolver: ParamsResolver = (provider) => {
    const json = Deno.env.get(credentialsEnvVarFor(provider));
    if (json !== undefined && json.trim() !== "") {
        // a rejected promise, never a synchronous throw — callers await
        return Promise.resolve().then(() =>
            parseCredentialsJson(provider, json)
        );
    }
    const value = Deno.env.get(envVarFor(provider));
    const params: Record<string, string> = {};
    if (value) params.apiKey = value;
    return Promise.resolve(params);
};

/** `<NAME>_CREDENTIALS` must be a JSON object of string values — anything
 *  else is a configuration error, reported as MISSING_CREDENTIAL so it
 *  lands in the same bucket as an absent key. */
function parseCredentialsJson(
    provider: string,
    json: string,
): Record<string, string> {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        throw new EngineError(
            EngineErrorCode.MISSING_CREDENTIAL,
            `${credentialsEnvVarFor(provider)} is not valid JSON`,
        );
    }
    if (
        parsed === null || typeof parsed !== "object" ||
        Array.isArray(parsed) ||
        Object.values(parsed).some((value) => typeof value !== "string")
    ) {
        throw new EngineError(
            EngineErrorCode.MISSING_CREDENTIAL,
            `${
                credentialsEnvVarFor(provider)
            } must be a JSON object of string values`,
        );
    }
    return parsed as Record<string, string>;
}

/**
 * OSS / local / tests: inject credentials HERE, then fetch.
 * `fetch` is injectable → fixture replay. Resolved values never logged.
 */
export function directTransport(opts: {
    params?: ParamsResolver;
    fetch?: typeof fetch;
} = {}): Transport {
    const resolveParams = opts.params ?? envParamsResolver;
    const doFetch = opts.fetch ?? fetch;
    return {
        async execute(req: PreparedRequest): Promise<TransportResponse> {
            // No auth block ⇒ the request egresses BARE (same-origin
            // credential rule, design D16) — credentials are never even
            // resolved for it.
            const authed = req.auth
                ? await applyAuth(
                    { ...req, auth: req.auth },
                    await resolveParams(req.provider),
                )
                : {
                    url: req.url,
                    headers: { ...req.headers },
                    query: { ...req.query },
                    ...(req.body !== undefined ? { body: req.body } : {}),
                };

            const url = new URL(authed.url);
            for (const [key, values] of Object.entries(authed.query)) {
                // append (never set) once per value — several values under
                // one key IS the repeated-parameter spelling, and ORDER is
                // the caller's
                for (const value of values) url.searchParams.append(key, value);
            }

            const controller = new AbortController();
            const timer = setTimeout(
                () => controller.abort(),
                req.timeouts.requestMs,
            );
            try {
                const response = await doFetch(url.toString(), {
                    method: req.method,
                    headers: {
                        ...(authed.body !== undefined
                            ? { "content-type": "application/json" }
                            : {}),
                        ...authed.headers,
                    },
                    body: authed.body !== undefined
                        ? JSON.stringify(authed.body)
                        : undefined,
                    signal: controller.signal,
                    redirect: "manual",
                });
                const body = await response.text();
                return {
                    status: response.status,
                    body,
                    // `redirect: "manual"` above means a 3xx arrives WITH its
                    // Location intact and an empty body — the header IS the
                    // payload for presigned-URL endpoints. Header keys are
                    // lowercased by the Fetch spec's Headers iterator.
                    headers: Object.fromEntries(response.headers),
                    contentType: response.headers.get("content-type") ??
                        undefined,
                };
            } catch (error) {
                if (error instanceof EngineError) throw error;
                throw new EngineError(
                    EngineErrorCode.EXECUTION_FAILED,
                    `transport failure calling ${req.provider}: ${error}`,
                    { cause: error },
                );
            } finally {
                clearTimeout(timer);
            }
        },
    };
}

/**
 * Hosted mode (interface stub — the implementation lives in monid-services):
 * forwards the PreparedRequest — auth fn ref + entry INTACT, credentials absent —
 * to the Relay, which validates authParams against the Broker credential (KMS),
 * hash-verifies and runs the same auth fn, applies egress hygiene, and returns
 * {status, body}. Secrets never enter the engine process.
 */
export function relayTransport(_opts: {
    relayUrl: string;
    callerAuth: () => Promise<string>;
}): Transport {
    return {
        execute(): Promise<TransportResponse> {
            return Promise.reject(
                new EngineError(
                    EngineErrorCode.NOT_IMPLEMENTED,
                    "relayTransport is implemented by the hosted Relay (monid-services)",
                ),
            );
        },
    };
}
