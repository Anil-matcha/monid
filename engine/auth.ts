import {
    type AuthData,
    AuthInjectContract,
    type AuthInjectFn,
    type HookLogger,
    type HttpRequestParts,
} from "@shared/core";
import { EngineError, EngineErrorCode } from "./errors.ts";
import { fnUtils } from "./fn-utils.ts";
import { resolveFn } from "./link.ts";
import type { PreparedRequest } from "./interfaces/mod.ts";
import { validateAgainst } from "./validate.ts";

/**
 * The ONLY place credentials meet a request. Called by injectors
 * (directTransport here; the hosted Relay runs the same procedure):
 *   1. validate RESOLVED params against the auth credentials JSON Schema
 *      (fail-closed presence check → MISSING_CREDENTIAL);
 *   2. hash-verify + instantiate the inject fn from the traveling entry;
 *   3. run it through the auth slot contract on {request, params} —
 *      only the RETURNED (contract-validated) request egresses.
 */
export async function applyAuth(
    req: PreparedRequest & { auth: NonNullable<PreparedRequest["auth"]> },
    params: Record<string, string>,
): Promise<HttpRequestParts> {
    const check = validateAgainst(req.auth.credentials, params);
    if (!check.ok) {
        throw new EngineError(
            EngineErrorCode.MISSING_CREDENTIAL,
            `provider ${req.provider}: credentials invalid: ${check.message}` +
                ` (hint: set ${envVarFor(req.provider)}, or ${
                    credentialsEnvVarFor(req.provider)
                } as a JSON object for a non-{apiKey} shape)`,
        );
    }
    const raw = await resolveFn(
        req.auth.inject.ref,
        { [req.auth.inject.ref.$fn.key]: req.auth.inject.entry },
        // the entry already passed the engine's ABI gate at load; re-verify integrity only
        req.auth.inject.entry.api,
        `${req.provider}#auth.inject`,
    );
    const impl = AuthInjectContract.implement(raw as AuthInjectFn);
    const data: AuthData = {
        request: {
            url: req.url,
            headers: { ...req.headers },
            query: { ...req.query },
            ...(req.body !== undefined ? { body: req.body } : {}),
        },
        params,
    };
    try {
        return impl({ data, utils: fnUtils, logger: SILENT_LOGGER });
    } catch (error) {
        throw new EngineError(
            EngineErrorCode.FN_CONTRACT,
            `${req.provider}: auth.inject broke its contract: ${error}`,
            { cause: error },
        );
    }
}

/** The auth hook's logger is DELIBERATELY silent regardless of host
 *  configuration: resolved credentials are in scope here, and a log line is
 *  the one way an inject fn could leak them. */
const SILENT_LOGGER: HookLogger = {
    debug() {},
    info() {},
    warn() {},
    error() {},
};

/** Convention: EXA_API_KEY for provider "exa" (dashes → underscores). */
export function envVarFor(provider: string): string {
    return `${provider.toUpperCase().replaceAll("-", "_")}_API_KEY`;
}

/**
 * Convention for a provider whose `auth.credentials` is NOT the default
 * `{apiKey}` (several keys, user + password): CONTACTOUT_CREDENTIALS holds
 * the WHOLE params object as JSON — the same shape the doc declares, so
 * the injector validates it against the same schema. Takes precedence over
 * `<NAME>_API_KEY` when set.
 */
export function credentialsEnvVarFor(provider: string): string {
    return `${provider.toUpperCase().replaceAll("-", "_")}_CREDENTIALS`;
}
