import {
    type EndpointDoc,
    type FnEntry,
    formatZodError,
    type JsonSchemaDoc,
    type RunInput,
    zRunInput,
} from "@shared/core";
import { EngineError, EngineErrorCode } from "./errors.ts";
import type { PreparedRequest } from "./interfaces/mod.ts";
import { validateAgainst, validateInputAgainst } from "./validate.ts";

/**
 * Validate the caller's input: first the RunInput shape itself (the engine
 * boundary trusts no host — CLI, tests, hosted workers all pass through here),
 * then the doc's input schemas.
 */
export function validateInput(doc: EndpointDoc, rawInput: unknown): RunInput {
    const shape = zRunInput.safeParse(rawInput);
    if (!shape.success) {
        throw new EngineError(
            EngineErrorCode.INVALID_INPUT,
            `${doc.id}: input ${formatZodError(shape.error)}`,
        );
    }
    const runInput = shape.data;
    const schemas = doc.input.schema;
    // BODY: validated on a clone the engine owns, with schema DEFAULTS
    // materialized into it (design D19 addendum — schema defaults mirror
    // the vendor's own server defaults, so hooks read the same effective
    // knobs the vendor applies). The caller's object is never mutated.
    if (schemas.body) {
        const body = runInput.body !== undefined
            ? structuredClone(runInput.body)
            : null;
        const result = validateInputAgainst(schemas.body, body);
        if (!result.ok) {
            throw new EngineError(
                EngineErrorCode.INVALID_INPUT,
                `${doc.id}: input.body ${result.message}`,
            );
        }
        runInput.body = body;
    }
    // QUERY/PATH PARAMS: same defaults-materializing validation as the
    // body (design D24 — a queryParams-shaped endpoint's estimate must
    // read the SAME effective knobs the vendor applies, e.g. akta's
    // limit default). Cloned — the caller's object is never mutated.
    const checks: [
        "queryParams" | "pathParams",
        JsonSchemaDoc | undefined,
    ][] = [
        ["queryParams", schemas.queryParams],
        ["pathParams", schemas.pathParams],
    ];
    for (const [label, schema] of checks) {
        if (!schema) continue;
        const value = structuredClone(runInput[label] ?? {});
        const result = validateInputAgainst(schema, value);
        if (!result.ok) {
            throw new EngineError(
                EngineErrorCode.INVALID_INPUT,
                `${doc.id}: input.${label} ${result.message}`,
            );
        }
        if (label === "queryParams") {
            runInput.queryParams = value as RunInput["queryParams"];
        } else {
            runInput.pathParams = value as RunInput["pathParams"];
        }
    }
    return runInput;
}

/** Substitute {pathParam} placeholders into the doc's compiled url — shared
 *  by the declarative pipeline (buildRequest) and the lifecycle ctx's
 *  data.request (fns receive the SUBSTITUTED url). */
export function substituteUrl(doc: EndpointDoc, input: RunInput): string {
    let url = doc.request.url;
    for (const placeholder of url.match(/\{[A-Za-z_][A-Za-z0-9_]*\}/g) ?? []) {
        const name = placeholder.slice(1, -1);
        const value = input.pathParams?.[name];
        if (value === undefined) {
            throw new EngineError(
                EngineErrorCode.INVALID_INPUT,
                `${doc.id}: missing pathParams.${name} for url placeholder`,
            );
        }
        url = url.replaceAll(placeholder, encodeURIComponent(value));
    }
    return url;
}

/**
 * Map queryParams to wire values — the MULTIMAP a query string really is
 * (shared by the declarative pipeline and utils.request/utils.http).
 *
 * A scalar is one value (`["v"]`); an ARRAY of scalars is a REPEATED key
 * (`?k=a&k=b`), which is the HTTP-native reading and the ONLY list
 * spelling the engine knows. A vendor wanting commas, brackets or a
 * JSON-encoded parameter joins/encodes in its own `input.toRequest` — the
 * spelling is a vendor fact, not an engine one. Objects, and arrays
 * holding anything but scalars, stay refused: a query string has no
 * nesting to encode them into.
 */
export function toWireQuery(
    docId: string,
    queryParams: Record<string, unknown>,
): Record<string, string[]> {
    const query: Record<string, string[]> = {};
    const scalar = (value: unknown, where: string): string => {
        if (value === null || typeof value === "object") {
            throw new EngineError(
                EngineErrorCode.INVALID_INPUT,
                `${docId}: queryParams.${where} must be a scalar or an ` +
                    `array of scalars (a query string cannot encode nesting)`,
            );
        }
        return String(value);
    };
    for (const [key, value] of Object.entries(queryParams)) {
        if (value === null || value === undefined) continue;
        if (!Array.isArray(value)) {
            query[key] = [scalar(value, key)]; // one value IS a one-list
            continue;
        }
        // an EMPTY list is "no value for this key": emit nothing. `?k=` is
        // a PRESENT, empty value to a vendor — not the same thing.
        if (value.length === 0) continue;
        query[key] = value.map((entry, index) =>
            scalar(entry, `${key}[${index}]`)
        );
    }
    return query;
}

/** Build the PreparedRequest: {pathParam} substitution, query mapping, JSON body. */
export function buildRequest(
    doc: EndpointDoc,
    input: RunInput,
    injectEntry: FnEntry,
): PreparedRequest {
    const url = substituteUrl(doc, input);
    const query = toWireQuery(doc.id, input.queryParams ?? {});

    return {
        method: doc.request.method,
        url,
        headers: { ...doc.request.headers },
        query,
        body: input.body,
        auth: {
            inject: { ref: doc.auth.inject, entry: injectEntry },
            credentials: doc.auth.credentials,
        },
        provider: doc.provider,
        timeouts: { requestMs: doc.timeouts.requestMs },
    };
}
