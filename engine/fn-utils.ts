import {
    type Currency,
    type EndpointDoc,
    type FnEntry,
    formatZodError,
    getPath,
    type HookLogger,
    type HttpResult,
    type Json,
    JsonPathError,
    type JsonUtil,
    type LifecycleRequestInfo,
    type LifecycleUtils,
    type MoneyUtil,
    PATH_PATTERN,
    type RunInput,
    zHttpCall,
    zRequestOverrides,
} from "@shared/core";
import type { Logger } from "@shared/logging";
import { EngineError, EngineErrorCode } from "./errors.ts";
import type { PreparedRequest, Transport } from "./interfaces/mod.ts";
import { toWireQuery } from "./request.ts";
import { sniffDecode } from "./transport.ts";

function lastSegment(path: string): string {
    const match = path.match(/\.([A-Za-z_][A-Za-z0-9_-]*)(\[\d+\])*$/);
    return match ? match[1] : path;
}

/** Path lookup that separates the three cases: syntax error (throw always),
 *  absent (undefined), present (the value). */
function lookup(value: Json, path: string): Json | undefined {
    if (!PATH_PATTERN.test(path)) {
        throw new JsonPathError(
            "PATH_SYNTAX",
            `invalid path syntax: ${path}`,
        );
    }
    return getPath(value, path);
}

function deepOmit(value: Json, keys: ReadonlySet<string>): Json {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map((item) => deepOmit(item, keys));
    const out: Record<string, Json> = {};
    for (const [key, item] of Object.entries(value)) {
        if (keys.has(key)) continue;
        out[key] = deepOmit(item, keys);
    }
    return out;
}

/** Remove EXACTLY the node at a (valid, present) restricted path —
 *  copy-on-write along the walk; containers stay otherwise untouched. */
function removeAtPath(value: Json, path: string): Json {
    const segments =
        path.slice(1).match(/\.[A-Za-z_][A-Za-z0-9_-]*|\[\d+\]/g) ?? [];
    if (segments.length === 0) return null; // plucking $ leaves nothing
    const walk = (current: Json, depth: number): Json => {
        const segment = segments[depth];
        const last = depth === segments.length - 1;
        if (segment.startsWith("[")) {
            if (!Array.isArray(current)) return current;
            const index = Number(segment.slice(1, -1));
            const out = [...current];
            if (last) out.splice(index, 1);
            else out[index] = walk(out[index], depth + 1);
            return out;
        }
        if (
            current === null || typeof current !== "object" ||
            Array.isArray(current)
        ) return current;
        const key = segment.slice(1);
        const out = { ...current };
        if (last) delete out[key];
        else out[key] = walk(out[key], depth + 1);
        return out;
    };
    return walk(value, 0);
}

function deepMerge(value: Json, fields: Record<string, Json>): Json {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        // merging fields into a non-object replaces it with the fields object
        return { ...fields };
    }
    const out: Record<string, Json> = { ...value };
    for (const [key, field] of Object.entries(fields)) {
        const existing = out[key];
        out[key] = existing !== null && typeof existing === "object" &&
                !Array.isArray(existing) &&
                field !== null && typeof field === "object" &&
                !Array.isArray(field)
            ? deepMerge(existing, field as Record<string, Json>)
            : field;
    }
    return out;
}

/**
 * The engine's JsonUtil implementation — `ctx.utils.json` (interface in
 * @shared/core schema/json/util.ts — the interface/impl split mirrors the
 * Logger pattern: contract in core, execution here).
 * Part of the fn ABI (versioned by ENGINE_VERSION), never fnTable content.
 *
 * STRICTNESS (see the interface contract in @shared/core): lookups throw on
 * absence (a typo'd path must never silently bill zero); `optional*` variants
 * return undefined on absence but STILL throw on a present value of the
 * wrong type; transformers stay shape-tolerant. Throws inside slot fns
 * surface as FN_CONTRACT — wrong bills fail closed.
 */
export const jsonUtil: JsonUtil = {
    get: (value, path) => {
        const found = lookup(value, path);
        if (found === undefined) {
            throw new JsonPathError(
                "PATH_NOT_FOUND",
                `json.get: nothing at ${path} (use optionalGet if absence is expected)`,
            );
        }
        return found;
    },
    optionalGet: (value, path) => lookup(value, path),
    num: (value, path) => {
        const found = lookup(value, path);
        if (found === undefined) {
            throw new JsonPathError(
                "PATH_NOT_FOUND",
                `json.num: nothing at ${path} (use optionalNum if absence is expected)`,
            );
        }
        if (typeof found !== "number" || !Number.isFinite(found)) {
            throw new JsonPathError(
                "TYPE_MISMATCH",
                `json.num: value at ${path} is not a finite number`,
            );
        }
        return found;
    },
    optionalNum: (value, path) => {
        const found = lookup(value, path);
        if (found === undefined) return undefined;
        if (typeof found !== "number" || !Number.isFinite(found)) {
            throw new JsonPathError(
                "TYPE_MISMATCH",
                `json.optionalNum: value at ${path} is not a finite number`,
            );
        }
        return found;
    },
    len: (value, path) => {
        const found = lookup(value, path);
        if (found === undefined) {
            throw new JsonPathError(
                "PATH_NOT_FOUND",
                `json.len: nothing at ${path} (use optionalLen if absence is expected)`,
            );
        }
        if (!Array.isArray(found)) {
            throw new JsonPathError(
                "TYPE_MISMATCH",
                `json.len: value at ${path} is not an array`,
            );
        }
        return found.length;
    },
    optionalLen: (value, path) => {
        const found = lookup(value, path);
        if (found === undefined) return undefined;
        if (!Array.isArray(found)) {
            throw new JsonPathError(
                "TYPE_MISMATCH",
                `json.optionalLen: value at ${path} is not an array`,
            );
        }
        return found.length;
    },
    /** Deep-remove the named keys anywhere in the value. */
    omit: (value, keys) => deepOmit(value, new Set(keys)),
    /** Keep only the values at the given paths (absent paths skipped), keyed by last segment. */
    pick: (value, paths) => {
        const out: Record<string, Json> = {};
        for (const path of paths) {
            const found = lookup(value, path);
            if (found !== undefined) out[lastSegment(path)] = found;
        }
        return out;
    },
    /** Deep-merge (append) fields into an object value; non-objects are replaced. */
    merge: (value, fields) => deepMerge(value, fields),
    /** One-motion extract (design D27): {value at path, input without it}. */
    pluck: (value, path) => {
        const found = lookup(value, path);
        if (found === undefined) return { rest: value };
        return { value: found, rest: removeAtPath(value, path) };
    },
};

/**
 * The engine's MoneyUtil implementation — `ctx.utils.money` (interface in
 * @shared/core schema/usage/monetary.ts; conversions match monid-services
 * monetary-conversions.ts). Micro-dollar is the canonical storage unit.
 */
export const moneyUtil: MoneyUtil = {
    fromDollars: (dollars, currency = "USD" as Currency) => ({
        currency,
        value: Math.round(dollars * 1_000_000),
        unit: "MICRO_DOLLAR",
    }),
    fromMicroDollars: (microDollars, currency = "USD" as Currency) => ({
        currency,
        value: Math.round(microDollars),
        unit: "MICRO_DOLLAR",
    }),
};

/** The ctx.utils namespace assembled by the engine (ALL of the hook ABI's
 *  host half lives in THIS file; the interfaces live in @shared/core). */
export const fnUtils = Object.freeze({ json: jsonUtil, money: moneyUtil });

/**
 * `ctx.utils` for the LIFECYCLE hook family — the pure ABI plus the two
 * effect capabilities, bound PER INVOCATION (they need this tick's derived
 * input + substituted request). The two differ ONLY in defaults:
 *
 *   - `http(call)` — the RAW, ZERO-defaults capability (v1
 *     `client.request`): `method` + exactly one of `url`|`path` required;
 *     `path` resolves against the doc request URL's ORIGIN (v1 apiPath
 *     semantics); `headers` ARE the complete outbound header set (no
 *     doc-header merge); `requestMs` overrides the per-request timeout.
 *   - `request(overrides?)` — the DEFAULT RELAY: executes THE endpoint's
 *     compiled request, initialized from data.request + the caller input
 *     (method/url/headers from the request; `body ?? input.body`;
 *     `queryParams ?? input.queryParams`), with a PRESENCE-BASED override
 *     merge — including the target (`url`|`path`), so `request` can do
 *     anything `http` can. `utils.request()` alone sends exactly what the
 *     declarative sync pipeline would.
 *
 * SAME-ORIGIN CREDENTIAL RULE (design D16): credentials are injected at
 * egress ONLY when the target origin equals the doc request's origin —
 * cross-origin calls (both capabilities) go out BARE. Fns never see
 * credentials either way.
 *
 * Responses come back sniff-decoded `{status, body}`; vendor non-2xx is
 * DATA (returned); transport failures throw EXECUTION_FAILED (retriable)
 * through the fn unless it catches. A malformed call/override shape is a
 * fn bug → FN_CONTRACT, fail-closed.
 */
export function makeLifecycleUtils(opts: {
    doc: EndpointDoc;
    injectEntry: FnEntry;
    transport: Transport;
    /** This invocation's compiled request ({pathParam}s substituted). */
    requestInfo: LifecycleRequestInfo;
    /** This invocation's derived (validated + toRequest) input. */
    input: RunInput;
}): LifecycleUtils {
    const { doc, injectEntry, transport, requestInfo, input } = opts;
    const origin = new URL(doc.request.url).origin;

    const execute = async (parts: {
        method: PreparedRequest["method"];
        url: string;
        headers?: Record<string, string>;
        /** The wire multimap (see PreparedRequest.query) — callers pass
         *  `toWireQuery` output, never a raw record. */
        query: Record<string, string[]>;
        body?: Json;
        requestMs?: number;
    }): Promise<HttpResult> => {
        // D16 — same-origin credential rule: auth travels only when the
        // target shares the doc request's origin; else the request is BARE.
        const sameOrigin = new URL(parts.url).origin === origin;
        const prepared: PreparedRequest = {
            method: parts.method,
            url: parts.url,
            headers: { ...parts.headers },
            query: parts.query,
            body: parts.body,
            ...(sameOrigin
                ? {
                    auth: {
                        inject: { ref: doc.auth.inject, entry: injectEntry },
                        credentials: doc.auth.credentials,
                    },
                }
                : {}),
            provider: doc.provider,
            timeouts: {
                requestMs: parts.requestMs ?? doc.timeouts.requestMs,
            },
        };
        const response = await transport.execute(prepared);
        return { status: response.status, body: sniffDecode(response) };
    };

    const utils: LifecycleUtils = {
        json: jsonUtil,
        money: moneyUtil,
        http: (call) => {
            const parsed = zHttpCall.safeParse(call);
            if (!parsed.success) {
                throw new EngineError(
                    EngineErrorCode.FN_CONTRACT,
                    `${doc.id}: utils.http call invalid: ${
                        formatZodError(parsed.error)
                    }`,
                );
            }
            const c = parsed.data;
            return execute({
                method: c.method,
                url: c.url ?? origin + c.path,
                headers: c.headers,
                // normalized through the ONE serializer, so a lifecycle fn
                // and the declarative pipeline spell lists identically
                query: toWireQuery(doc.id, c.queryParams ?? {}),
                body: c.body,
                requestMs: c.requestMs,
            });
        },
        request: (overrides) => {
            const parsed = zRequestOverrides.safeParse(overrides ?? {});
            if (!parsed.success) {
                throw new EngineError(
                    EngineErrorCode.FN_CONTRACT,
                    `${doc.id}: utils.request overrides invalid: ${
                        formatZodError(parsed.error)
                    }`,
                );
            }
            const o = parsed.data;
            return execute({
                method: o.method ?? requestInfo.method,
                // presence-based target override: url | path | the
                // compiled request's own url
                url: o.url ??
                    (o.path !== undefined ? origin + o.path : requestInfo.url),
                headers: { ...requestInfo.headers, ...o.headers },
                query: toWireQuery(
                    doc.id,
                    o.queryParams ?? input.queryParams ?? {},
                ),
                // PRESENCE-based body override (not ??): body is zJson and
                // null IS valid JSON — `{body: null}` must override with
                // null, never fall back to the caller input (PR #2 finding)
                body: "body" in o && o.body !== undefined ? o.body : input.body,
                requestMs: o.requestMs,
            });
        },
    };
    return Object.freeze(utils);
}

/** Adapt the host Logger into the fn-facing HookLogger (ctx.logger). */
export function toHookLogger(logger: Logger): HookLogger {
    return {
        debug: (message, fields) => logger.debug(message, fields),
        info: (message, fields) => logger.info(message, fields),
        warn: (message, fields) => logger.warn(message, fields),
        error: (message, fields) => logger.error(message, fields),
    };
}
