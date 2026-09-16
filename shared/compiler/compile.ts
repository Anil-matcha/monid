import { z } from "zod";
import { format, greaterThan, parse as parseSemver } from "@std/semver";
import {
    assertPureJson,
    type Bundle,
    type ConnectorSource,
    contractConfig,
    type Credits,
    docHash,
    type EndpointDoc,
    type FnRef,
    hasMeteredLines,
    type Json,
    type LeafCategory,
    parseSchema,
    type ProviderDoc,
    pruneUndefined,
    stableStringify,
    ValidationError,
    zBundle,
    zDefaultCredentials,
    zEndpointDef,
    zEndpointDoc,
    zEndpointName,
    zEndpointPath,
    zProviderDef,
    zProviderDoc,
} from "@shared/core";
import type { Logger } from "@shared/logging";
import { FnInterner } from "./fns.ts";

/** Contract constants — config.yml `schema:`/`compiler:` sections (override-free). */
const SC = contractConfig.schema;
const CC = contractConfig.compiler;

/**
 * CompileError — every compiler rejection, coded so build tooling (and
 * tests) can branch on WHY without string-matching. `retriable = false` by
 * construction: a compile failure is deterministic — the same repo bytes
 * fail the same way.
 */
export const CompileErrorCode = {
    /** A zod schema is not JSON-Schema representable. */
    SCHEMA_INVALID: "SCHEMA_INVALID",
    /** A required hook resolved nowhere (endpoint ?? provider). */
    HOOK_UNRESOLVED: "HOOK_UNRESOLVED",
    /** lifecycle.state failed JSON Schema conversion / is dead config. */
    STATE_SCHEMA_INVALID: "STATE_SCHEMA_INVALID",
    /** Structural def problems: bad baseUrl, dead config, size, vocabulary. */
    DOC_MALFORMED: "DOC_MALFORMED",
} as const;
export type CompileErrorCode = keyof typeof CompileErrorCode;

export class CompileError extends Error {
    readonly retriable = false;
    constructor(
        readonly code: CompileErrorCode,
        message: string,
        options?: { cause?: unknown },
    ) {
        super(`[${code}] ${message}`, options);
        this.name = "CompileError";
    }
}

/** parseSchema at the COMPILER boundary: every compiler rejection must be
 *  a coded CompileError (build tooling branches on WHY without
 *  string-matching), so def-shape failures — e.g. a malformed baseUrl —
 *  rethrow as DOC_MALFORMED with the ValidationError preserved as cause.
 *  Author-time `defineEndpoint` keeps throwing ValidationError: that IS
 *  the authoring surface, correctly uncoded (PR #2 finding). */
function parseDoc<T extends z.ZodType>(
    schema: T,
    input: unknown,
    context: string,
): z.output<T> {
    try {
        return parseSchema(schema, input, context);
    } catch (error) {
        if (error instanceof ValidationError) {
            throw new CompileError(
                CompileErrorCode.DOC_MALFORMED,
                error.message,
                { cause: error },
            );
        }
        throw error;
    }
}

export interface CompileOptions {
    /** Toolchain provenance — never gates (engine gates on minEngineVersion + specVersion). */
    compilerVersion: string;
    builtWithEngineVersion: string;
    catalogVersion: string;
    generatedAt: string;
    /** The closed category vocabulary (connectors/categories.ts). */
    leafCategories: readonly LeafCategory[];
    logger?: Logger;
}

function semverMax(versions: string[]): string {
    let max = parseSemver(SC.docFormatSince);
    for (const version of versions) {
        const parsed = parseSemver(version);
        if (greaterThan(parsed, max)) max = parsed;
    }
    return format(max);
}

function toJsonSchema(
    schema: z.ZodType,
    label: string,
    code: CompileErrorCode = CompileErrorCode.SCHEMA_INVALID,
): Record<string, Json> {
    try {
        const jsonSchema = z.toJSONSchema(schema, {
            target: `draft-${SC.jsonSchemaDialect}` as "draft-2020-12",
            io: "input",
        });
        return pruneUndefined(jsonSchema) as Record<string, Json>;
    } catch (error) {
        throw new CompileError(
            code,
            `${label}: zod schema is not JSON-Schema representable: ${error}`,
            { cause: error },
        );
    }
}

/** A resolvable leaf: the value + WHERE it came from.
 *  The label exists solely to keep FnEntry.provenance truthful — a
 *  provider-authored fn must be blamed on provider.ts, not on whichever
 *  endpoint happened to resolve it first. */
interface Resolved<T> {
    value: T;
    label: string;
}

/** Leaf-wise fallback: endpoint value wins, else provider's — with its origin label. */
function resolve<T>(
    endpointValue: T | undefined,
    endpointLabel: string,
    providerValue: T | undefined,
    providerLabel: string,
): Resolved<T> | undefined {
    if (endpointValue !== undefined) {
        return { value: endpointValue, label: endpointLabel };
    }
    if (providerValue !== undefined) {
        return { value: providerValue, label: providerLabel };
    }
    return undefined;
}

/** The ONE lawful quantities fn for a model with no metered lines
 *  (design D27) — the compiler materializes it into the doc (a real
 *  interned fnTable entry: the compiled doc stays comprehensive) when
 *  neither endpoint nor provider declares estimate/evidence. Module-
 *  scope so its SOURCE is stable and interns to a single shared entry. */
const SYNTHESIZED_EMPTY_USAGE = () => ({ counts: {} });

/**
 * compileBundle — the compiler's SOLE job: the pure mapping
 * (defs, options) → bundle. Folder identity is a LOADER concern
 * (loadConnectorDefs asserts folder == provider.name); here everything keys
 * off `provider.name`. Loading lives in @shared/core (load/); list/inspect
 * over bundles lives in core's catalog.
 *
 * ONE composition rule (design D20): everything resolves LEAF-WISE, closest
 * wins — endpoint ?? provider ?? config default. That includes hooks
 * (endpoint toRequest/fromResponse/evidence REPLACES the provider's) and
 * meta leaves (docsUrl/categories). Headers merge key-wise (each key is a
 * leaf).
 */
export async function compileBundle(
    connectors: ConnectorSource[],
    opts: CompileOptions,
): Promise<Bundle> {
    const logger = opts.logger;
    // categories ∈ registry, zod-delegated: an enum built from the vocabulary
    const zCategories = z.array(
        z.enum(
            opts.leafCategories.map((leaf) => leaf.id) as [string, ...string[]],
        ),
    ).optional();
    const interner = new FnInterner();
    const providers: Record<string, ProviderDoc> = {};
    const endpoints: Record<string, EndpointDoc> = {};
    const allDocs: EndpointDoc[] = [];

    // intake validation — zod-first end to end even for hand-built sources
    const intake = connectors.map((connector) =>
        parseDoc(zProviderDef, connector.provider, "provider def")
    );
    // DETERMINISM: input order (filesystem enumeration) is platform-dependent,
    // and iteration order decides fnTable insertion (first occurrence wins
    // provenance) — sorting by provider/endpoint name makes the bundle a pure
    // function of repo content (byte-identical double compile).
    const sorted = connectors
        .map((connector, index) => ({ connector, provider: intake[index] }))
        .sort((a, b) => a.provider.name.localeCompare(b.provider.name));

    for (const { connector, provider } of sorted) {
        const providerName = provider.name;
        const providerFile = `connectors/${providerName}/provider.ts`;
        parseCategories(zCategories, provider.meta.categories, providerFile);

        const providerEndpointDocs: EndpointDoc[] = [];
        // D6b: a PROVIDER-declared pool is a provider-wide fact — it must
        // be drained by at least ONE of its endpoints, not by each one.
        const drainedByProvider = new Set<string>();
        const sortedEndpoints = [...connector.endpoints]
            .sort((a, b) => a.name.localeCompare(b.name)); // determinism (see above)
        for (const { name: endpointName, def: rawDef } of sortedEndpoints) {
            parseDoc(
                zEndpointName,
                endpointName,
                `connectors/${providerName}/endpoints/${endpointName} (folder name)`,
            );
            const where =
                `connectors/${providerName}/endpoints/${endpointName}`;
            const endpointFile = `${where}/endpoint.ts`;
            const def = parseDoc(zEndpointDef, rawDef, endpointFile);

            // ---- PUBLIC identity (design D22): the def's `endpoint` path
            // ?? request.path (trailing slashes stripped) — folder names
            // are ORGANIZATIONAL only, never identity. id = provider# +
            // the path minus its leading slash ("apify#apidojo/tweet-scraper").
            const endpointPath = parseDoc(
                zEndpointPath,
                def.endpoint ?? def.request.path.replace(/\/+$/, ""),
                `${endpointFile}#endpoint (?? request.path)`,
            );
            const id = `${providerName}#${endpointPath.slice(1)}`;
            if (endpoints[id] !== undefined) {
                throw new CompileError(
                    CompileErrorCode.DOC_MALFORMED,
                    `${where}: duplicate endpoint identity ${id} — two defs ` +
                        `resolve to the same endpoint path`,
                );
            }

            // ---- meta: leaf-wise fallback (docsUrl/categories) ------------
            const categories = def.meta.categories ?? provider.meta.categories;
            parseCategories(zCategories, categories, where);
            const meta = pruneUndefined({
                ...def.meta,
                docsUrl: def.meta.docsUrl ?? provider.meta.docsUrl,
                categories,
            } as unknown as Json);

            // ---- request: baseUrl fallback, key-wise header merge ---------
            const baseUrl = def.request.baseUrl ?? provider.request?.baseUrl;
            if (baseUrl === undefined) {
                throw new CompileError(
                    CompileErrorCode.DOC_MALFORMED,
                    `${where}: no baseUrl — set request.baseUrl on the endpoint ` +
                        `or request.baseUrl on the provider`,
                );
            }
            // CONCATENATE, don't URL-resolve: `new URL("/v1/x", "https://h/api")`
            // would DROP the base's `/api` path prefix (absolute paths replace
            // the whole base path — akta's baseUrl exposed this). Concatenation
            // preserves the prefix; the URL constructor still validates.
            // A query string or fragment in the base would swallow the path
            // (`…?tenant=x` + `/v1` ⇒ path inside the query) — reject it; a
            // fixed query param belongs in the endpoint def, not the baseUrl.
            const parsedBase = new URL(baseUrl);
            if (parsedBase.search !== "" || parsedBase.hash !== "") {
                throw new CompileError(
                    CompileErrorCode.DOC_MALFORMED,
                    `${where}: baseUrl must not contain a query string or ` +
                        `fragment (got ${baseUrl})`,
                );
            }
            // The URL constructor percent-encodes `{` / `}`, which would
            // turn a `{pathParam}` placeholder into `%7BpathParam%7D` — a
            // literal the engine's substituteUrl can never match (fundable's
            // `/deals/{id}` exposed this). Restore the placeholders AFTER
            // normalization so every other url byte stays as before.
            const url = new URL(
                baseUrl.replace(/[?#]*$/, "").replace(/\/+$/, "") +
                    def.request.path,
            )
                .toString()
                .replace(/%7B([A-Za-z_][A-Za-z0-9_]*)%7D/g, "{$1}");
            const headers = {
                ...provider.request?.headers,
                ...def.request.headers,
            };

            // ---- lifecycle: leaf-wise phase fallback + completeness -------
            const lifecycleStart = resolve(
                def.lifecycle?.start,
                `${endpointFile}#lifecycle.start`,
                provider.lifecycle?.start,
                `${providerFile}#lifecycle.start`,
            );
            const lifecyclePoll = resolve(
                def.lifecycle?.poll,
                `${endpointFile}#lifecycle.poll`,
                provider.lifecycle?.poll,
                `${providerFile}#lifecycle.poll`,
            );
            const lifecycleStop = resolve(
                def.lifecycle?.stop,
                `${endpointFile}#lifecycle.stop`,
                provider.lifecycle?.stop,
                `${providerFile}#lifecycle.stop`,
            );
            if ((lifecyclePoll || lifecycleStop) && !lifecycleStart) {
                throw new CompileError(
                    CompileErrorCode.HOOK_UNRESOLVED,
                    `${where}: lifecycle.poll/stop without lifecycle.start — ` +
                        `start must resolve (endpoint ?? provider) whenever any ` +
                        `lifecycle phase does`,
                );
            }
            // Lifecycle fns are the ASYNC hook family — stamped with
            // schema.async_since, which floors minEngineVersion for the doc.
            const lifecycleStartRef = lifecycleStart
                ? await interner.intern(
                    lifecycleStart.value,
                    lifecycleStart.label,
                    SC.asyncSince,
                )
                : undefined;
            const lifecyclePollRef = lifecyclePoll
                ? await interner.intern(
                    lifecyclePoll.value,
                    lifecyclePoll.label,
                    SC.asyncSince,
                )
                : undefined;
            const lifecycleStopRef = lifecycleStop
                ? await interner.intern(
                    lifecycleStop.value,
                    lifecycleStop.label,
                    SC.asyncSince,
                )
                : undefined;

            // TYPED STATE (lifecycle.state → doc.lifecycle.stateSchema):
            // resolved leaf-wise like the phase fns; a declared state
            // schema without a resolved start is dead config.
            const lifecycleState = resolve(
                def.lifecycle?.state,
                `${endpointFile}#lifecycle.state`,
                provider.lifecycle?.state,
                `${providerFile}#lifecycle.state`,
            );
            if (lifecycleState && !lifecycleStart) {
                throw new CompileError(
                    CompileErrorCode.STATE_SCHEMA_INVALID,
                    `${where}: lifecycle.state is dead config — no resolved ` +
                        `lifecycle.start`,
                );
            }
            const stateSchema = lifecycleState
                ? toJsonSchema(
                    lifecycleState.value,
                    `${where}: lifecycle.state`,
                    CompileErrorCode.STATE_SCHEMA_INVALID,
                )
                : undefined;

            // pollMs is meaningful only for pollable docs: an ENDPOINT-level
            // pollMs on a doc without a resolved poll is dead config (a
            // provider-level pollMs is a legitimate default over a mixed
            // sync/async endpoint set and is simply not emitted).
            if (def.timeouts?.pollMs !== undefined && !lifecyclePoll) {
                throw new CompileError(
                    CompileErrorCode.DOC_MALFORMED,
                    `${where}: timeouts.pollMs is dead config — the endpoint ` +
                        `has no resolved lifecycle.poll`,
                );
            }
            const timeouts = {
                requestMs: def.timeouts?.requestMs ??
                    provider.timeouts?.requestMs ??
                    CC.defaultTimeouts.requestMs,
                runMs: def.timeouts?.runMs ?? provider.timeouts?.runMs ??
                    CC.defaultTimeouts.runMs,
                pollMs: lifecyclePoll
                    ? def.timeouts?.pollMs ?? provider.timeouts?.pollMs ??
                        CC.defaultTimeouts.pollMs
                    : undefined,
            };

            // ---- auth: inject REQUIRED; credentials ?? default ------------
            const inject = resolve(
                def.auth?.inject,
                `${endpointFile}#auth.inject`,
                provider.auth?.inject,
                `${providerFile}#auth.inject`,
            );
            if (!inject) {
                throw new CompileError(
                    CompileErrorCode.HOOK_UNRESOLVED,
                    `${where}: auth.inject must resolve — declare it on the endpoint ` +
                        `or the provider (e.g. presets.auth.header("x-api-key"))`,
                );
            }
            const injectRef = await interner.intern(
                inject.value,
                inject.label,
                SC.fnAbiSince,
            );
            const credentialsSchema = toJsonSchema(
                def.auth?.credentials ?? provider.auth?.credentials ??
                    zDefaultCredentials,
                `${where}: auth.credentials`,
            );

            // ---- hooks: FALLBACK (endpoint hook replaces provider's) ------
            const toRequest = resolve(
                def.input?.toRequest,
                `${endpointFile}#input.toRequest`,
                provider.input?.toRequest,
                `${providerFile}#input.toRequest`,
            );
            const toRequestRef = toRequest
                ? await interner.intern(
                    toRequest.value,
                    toRequest.label,
                    SC.fnAbiSince,
                )
                : undefined;
            const fromResponse = resolve(
                def.output?.fromResponse,
                `${endpointFile}#output.fromResponse`,
                provider.output?.fromResponse,
                `${providerFile}#output.fromResponse`,
            );
            const fromResponseRef = fromResponse
                ? await interner.intern(
                    fromResponse.value,
                    fromResponse.label,
                    SC.fnAbiSince,
                )
                : undefined;
            const fromError = resolve(
                def.output?.fromError,
                `${endpointFile}#output.fromError`,
                provider.output?.fromError,
                `${providerFile}#output.fromError`,
            );
            const fromErrorRef = fromError
                ? await interner.intern(
                    fromError.value,
                    fromError.label,
                    SC.fnAbiSince,
                )
                : undefined;

            // ---- usage.model (inline DATA, REQUIRED) ----------------------
            const usageModel = def.usage?.model ?? provider.usage?.model;
            if (usageModel === undefined) {
                throw new CompileError(
                    CompileErrorCode.HOOK_UNRESOLVED,
                    `${where}: usage.model must resolve — declare it on the ` +
                        `endpoint or the provider; every doc states what is ` +
                        `chargeable (design D19).`,
                );
            }
            const meteredCount = usageModel.kind === "COMPOSITE"
                ? Object.values(usageModel.components)
                    .filter((component) => component.kind === "PER_UNIT")
                    .length
                : usageModel.kind === "PER_UNIT"
                ? 1
                : 0;
            // ≥2 METERED components ⇒ only DOC-owned fns can know which
            // line a count belongs to — a GENERIC provider evidence fn
            // keys by "the sole PER_UNIT line" and would have no basis to
            // choose between two (design D19). Reject at build time, not
            // at the first live run. (Checked FIRST — the more specific
            // diagnosis wins over the general must-resolve rule.)
            if (usageModel.kind === "COMPOSITE" && meteredCount >= 2) {
                if (def.usage?.evidence === undefined) {
                    throw new CompileError(
                        CompileErrorCode.HOOK_UNRESOLVED,
                        `${where}: ${meteredCount} metered components — ` +
                            `a doc-level usage.evidence must key its ` +
                            `own counts (the generic provider fn cannot ` +
                            `choose between them)`,
                    );
                }
                if (def.usage?.estimate === undefined) {
                    throw new CompileError(
                        CompileErrorCode.HOOK_UNRESOLVED,
                        `${where}: ≥2 metered components require a ` +
                            `doc-level usage.estimate too (same keying)`,
                    );
                }
            }
            // ---- usage.estimate + usage.evidence: the QUANTITIES pair ----
            // (design D27 subclassing): endpoint ?? provider, and when
            // NEITHER declares one AND the model has no metered lines, the
            // compiler synthesizes the one lawful fn — `{counts: {}}` is
            // the only return a FREE/flat model admits, so writing it by
            // hand adds no information. A METERED model's quantities
            // depend on input/response — must resolve (the deduced-
            // estimate guarantee, designs D24/D25).
            const metered = hasMeteredLines(usageModel);
            const estimateFn = resolve(
                def.usage?.estimate,
                `${endpointFile}#usage.estimate`,
                provider.usage?.estimate,
                `${providerFile}#usage.estimate`,
            );
            const evidenceFn = resolve(
                def.usage?.evidence,
                `${endpointFile}#usage.evidence`,
                provider.usage?.evidence,
                `${providerFile}#usage.evidence`,
            );
            if (metered && !estimateFn) {
                throw new CompileError(
                    CompileErrorCode.HOOK_UNRESOLVED,
                    `${where}: usage.estimate must resolve — the model has ` +
                        `metered lines, so the promise depends on the ` +
                        `input (deduced estimates, design D24/D27)`,
                );
            }
            if (metered && !evidenceFn) {
                throw new CompileError(
                    CompileErrorCode.HOOK_UNRESOLVED,
                    `${where}: usage.evidence must resolve — the model has ` +
                        `metered lines, so the settled quantities depend ` +
                        `on the response (design D27)`,
                );
            }
            const estimateRef = estimateFn
                ? await interner.intern(
                    estimateFn.value,
                    estimateFn.label,
                    SC.fnAbiSince,
                )
                : await interner.intern(
                    SYNTHESIZED_EMPTY_USAGE,
                    "core#usage.synthesizedEmpty",
                    SC.fnAbiSince,
                );
            const evidenceRef = evidenceFn
                ? await interner.intern(
                    evidenceFn.value,
                    evidenceFn.label,
                    SC.fnAbiSince,
                )
                : await interner.intern(
                    SYNTHESIZED_EMPTY_USAGE,
                    "core#usage.synthesizedEmpty",
                    SC.fnAbiSince,
                );

            // ---- usage.consolidate: the VENDOR-METER fn, OPTIONAL --------
            // (design D27 — not every vendor reports one; typically
            // provider-level: where the meter lives is a provider-wide
            // fact, so the claim + strip is written once).
            const consolidate = resolve(
                def.usage?.consolidate,
                `${endpointFile}#usage.consolidate`,
                provider.usage?.consolidate,
                `${providerFile}#usage.consolidate`,
            );
            const consolidateRef = consolidate
                ? await interner.intern(
                    consolidate.value,
                    consolidate.label,
                    SC.fnAbiSince,
                )
                : undefined;

            // ---- credits (design D26, revised D6): the credit systems
            // the model's lines drain — declared beside the model,
            // resolved KEY-WISE endpoint over provider (the D20 rule,
            // like request.headers: a provider declares its pool SET
            // once, an endpoint adds or restates only what diverges),
            // referenced by every consumes.credit. The def IS the rate
            // card; the broker prices ONLY these ids.
            if (usageModel.kind === "FREE" && def.usage?.credits) {
                throw new CompileError(
                    CompileErrorCode.HOOK_UNRESOLVED,
                    `${where}: usage.credits on a FREE doc — free drains ` +
                        `nothing (design D26: compiled FREE credits = {})`,
                );
            }
            const declared: Credits = usageModel.kind === "FREE" ? {} : {
                ...provider.usage?.credits,
                ...def.usage?.credits,
            };
            if (
                usageModel.kind !== "FREE" &&
                Object.keys(declared).length === 0
            ) {
                throw new CompileError(
                    CompileErrorCode.HOOK_UNRESOLVED,
                    `${where}: usage.credits must resolve — a billable ` +
                        `model's lines drain declared credit systems ` +
                        `(design D26; a provider declares its pool SET ` +
                        `once — {default: {...}} for single-pool vendors — ` +
                        `and an endpoint may add or restate one key-wise)`,
                );
            }
            const consumesLines: [string, { credit: string }][] =
                usageModel.kind === "COMPOSITE"
                    ? Object.entries(usageModel.components).map((
                        [id, component],
                    ) => [id, component.consumes])
                    : usageModel.kind === "FREE"
                    ? []
                    : [[
                        usageModel.kind === "PER_UNIT"
                            ? usageModel.unit
                            : "CALL",
                        usageModel.consumes,
                    ]];
            const declaredIds = new Set(Object.keys(declared));
            for (const [lineId, consumes] of consumesLines) {
                if (!declaredIds.has(consumes.credit)) {
                    throw new CompileError(
                        CompileErrorCode.HOOK_UNRESOLVED,
                        `${where}: line "${lineId}" consumes undeclared ` +
                            `credit "${consumes.credit}" (declared: ` +
                            `${[...declaredIds].join(", ") || "none"})`,
                    );
                }
            }
            const usedIds = new Set(
                consumesLines.map(([, consumes]) => consumes.credit),
            );
            // an ENDPOINT-level declaration is endpoint-SCOPED: drained
            // here or dead config. Provider-level pools are checked ONCE
            // per provider, after the endpoint loop (design D6b).
            for (const id of Object.keys(def.usage?.credits ?? {})) {
                if (!usedIds.has(id)) {
                    throw new CompileError(
                        CompileErrorCode.HOOK_UNRESOLVED,
                        `${where}: endpoint-declared credit "${id}" is ` +
                            `drained by no line of this endpoint — remove ` +
                            `it, reference it, or move it to the provider`,
                    );
                }
            }
            for (const id of usedIds) drainedByProvider.add(id);
            // the doc carries ONLY what it drains (design D6c) — sorted
            // for a deterministic emitted key order (the hash is RFC 8785
            // either way); every id is declared, checked just above.
            const credits: Credits = Object.fromEntries(
                [...usedIds].sort().map((id) => [id, declared[id]]),
            );

            // ---- input/output schemas: leaf-wise fallback -----------------
            const schemaLeaf = (
                endpointSchema: z.ZodType | undefined,
                providerSchema: z.ZodType | undefined,
                label: string,
            ) => {
                const resolved = endpointSchema ?? providerSchema;
                return resolved ? toJsonSchema(resolved, label) : undefined;
            };

            // ---- minEngineVersion: AUTO-ONLY ------------------------------
            const refs = [
                injectRef,
                toRequestRef,
                fromResponseRef,
                fromErrorRef,
                consolidateRef,
                estimateRef,
                lifecycleStartRef,
                lifecyclePollRef,
                lifecycleStopRef,
            ]
                .filter((ref): ref is FnRef => ref !== undefined);
            const minEngineVersion = semverMax(
                refs.map((ref) => interner.table[ref.$fn.key].api),
            );

            // ---- assemble + validate --------------------------------------
            const docWithoutHash = pruneUndefined({
                specVersion: SC.specVersion,
                id,
                endpoint: endpointPath,
                provider: providerName,
                minEngineVersion,
                meta,
                auth: {
                    inject: injectRef as unknown as Json,
                    credentials: credentialsSchema,
                },
                request: {
                    method: def.request.method,
                    url,
                    headers: Object.keys(headers).length > 0
                        ? headers
                        : undefined,
                },
                input: {
                    schema: {
                        body: schemaLeaf(
                            def.input?.schema?.body,
                            provider.input?.schema?.body,
                            `${where}: input.schema.body`,
                        ),
                        queryParams: schemaLeaf(
                            def.input?.schema?.queryParams,
                            provider.input?.schema?.queryParams,
                            `${where}: input.schema.queryParams`,
                        ),
                        pathParams: schemaLeaf(
                            def.input?.schema?.pathParams,
                            provider.input?.schema?.pathParams,
                            `${where}: input.schema.pathParams`,
                        ),
                    },
                    toRequest: toRequestRef as unknown as Json,
                },
                output: {
                    fromResponse: fromResponseRef as unknown as Json,
                    fromError: fromErrorRef as unknown as Json,
                    schema: schemaLeaf(
                        def.output?.schema,
                        provider.output?.schema,
                        `${where}: output.schema`,
                    ),
                },
                usage: {
                    model: usageModel as unknown as Json,
                    credits: credits as unknown as Json,
                    estimate: estimateRef as unknown as Json,
                    evidence: evidenceRef as unknown as Json,
                    consolidate: consolidateRef as unknown as Json,
                },
                lifecycle: lifecycleStartRef
                    ? {
                        start: lifecycleStartRef as unknown as Json,
                        poll: lifecyclePollRef as unknown as Json,
                        stop: lifecycleStopRef as unknown as Json,
                        stateSchema: stateSchema as unknown as Json,
                    }
                    : undefined,
                timeouts,
            }) as Record<string, Json>;

            const hash = await docHash(docWithoutHash);
            const doc = parseDoc(
                zEndpointDoc,
                { ...docWithoutHash, hash },
                where,
            );

            const size = stableStringify(docWithoutHash).length;
            if (size > CC.docSizeFailBytes) {
                throw new CompileError(
                    CompileErrorCode.DOC_MALFORMED,
                    `${where}: doc size ${size} > ${CC.docSizeFailBytes}`,
                );
            }
            if (size > CC.docSizeWarnBytes) {
                logger?.warn(`doc size over warn threshold`, { where, size });
            }

            assertPureJson(doc, `${where} compiled doc`);
            providerEndpointDocs.push(doc);
            endpoints[doc.id] = doc; // sorted insertion (see determinism note)
            allDocs.push(doc);
        }

        // ---- D6b: every PROVIDER-declared pool is drained by at least
        // ONE endpoint — what makes a multi-pool provider (pdl's four
        // x-call-credits-type pools) declarable in ONE place.
        for (const id of Object.keys(provider.usage?.credits ?? {})) {
            if (!drainedByProvider.has(id)) {
                throw new CompileError(
                    CompileErrorCode.HOOK_UNRESOLVED,
                    `${providerFile}: declared credit "${id}" is drained ` +
                        `by no endpoint — remove it or reference it from ` +
                        `a line's consumes.credit (drained: ` +
                        `${
                            [...drainedByProvider].sort().join(", ") || "none"
                        })`,
                );
            }
        }

        // ---- ProviderDoc: identity + display only (nothing derivable) -----
        const providerWithoutHash = pruneUndefined({
            specVersion: SC.specVersion,
            name: providerName,
            minEngineVersion: semverMax(
                providerEndpointDocs.map((doc) => doc.minEngineVersion),
            ),
            meta: provider.meta as unknown as Json,
        }) as Record<string, Json>;
        providers[providerName] = parseDoc(zProviderDoc, {
            ...providerWithoutHash,
            hash: await docHash(providerWithoutHash),
        }, providerFile);
    }

    // ---- taxonomy: closed vocabulary + endpoint membership ----------------
    const membership: Record<string, string[]> = {};
    for (const doc of [...allDocs].sort((a, b) => a.id.localeCompare(b.id))) {
        for (const categoryId of doc.meta.categories ?? []) {
            (membership[categoryId] ??= []).push(doc.id);
        }
    }

    // ---- bundle assembly — cross-doc invariants live in zBundle.superRefine
    const bundle = parseDoc(zBundle, {
        catalogVersion: opts.catalogVersion,
        generatedAt: opts.generatedAt,
        minEngineVersion: semverMax(allDocs.map((doc) => doc.minEngineVersion)),
        toolchain: {
            compilerVersion: opts.compilerVersion,
            builtWithEngineVersion: opts.builtWithEngineVersion,
        },
        providers,
        endpoints,
        taxonomy: {
            leaves: [...opts.leafCategories],
            membership: Object.fromEntries(
                Object.keys(membership).sort().map((
                    key,
                ) => [key, membership[key]]),
            ),
        },
        fnTable: interner.sorted(),
    }, "compiled bundle");
    assertPureJson(bundle, "bundle");
    return bundle;
}

function parseCategories(
    zCategories: z.ZodType,
    categories: readonly string[] | undefined,
    where: string,
): void {
    const result = zCategories.safeParse(categories);
    if (!result.success) {
        throw new CompileError(
            CompileErrorCode.DOC_MALFORMED,
            `${where}: unknown category — add it to connectors/categories.ts (closed ` +
                `vocabulary): ${result.error.issues[0]?.message}`,
        );
    }
}
