import { fromFileUrl, join } from "@std/path";
import {
    type Bundle,
    loadCategoryRegistry,
    loadConnectorDefs,
    type RunInput,
    type SealedUnit,
    sealUnit,
    type Usage,
} from "@shared/core";
import {
    directTransport,
    Engine,
    ENGINE_VERSION,
    envParamsResolver,
    type RunCompleted,
} from "@monid/connector-engine";
import { compileBundle } from "@shared/compiler";
import {
    type Fixture,
    type RecordedCall,
    recordingFetch,
    replayFetch,
} from "./fixtures.ts";

export type RunMode = "replay" | "record" | "live";

const REPO_ROOT = fromFileUrl(new URL("../../", import.meta.url));

let cachedBundle: Promise<Bundle> | undefined;

/** Compile all connectors once per test process — tests run the ARTIFACT. */
export function testBundle(): Promise<Bundle> {
    cachedBundle ??= (async () => {
        const connectorsDir = join(REPO_ROOT, "connectors");
        const [connectors, leafCategories, compilerDenoJson] = await Promise
            .all([
                loadConnectorDefs(connectorsDir),
                loadCategoryRegistry(connectorsDir),
                Deno.readTextFile(
                    join(REPO_ROOT, "shared", "compiler", "deno.json"),
                ),
            ]);
        return await compileBundle(connectors, {
            compilerVersion: JSON.parse(compilerDenoJson).version,
            builtWithEngineVersion: ENGINE_VERSION,
            catalogVersion: "0.0.0-test",
            generatedAt: "1970-01-01T00:00:00.000Z",
            leafCategories,
        });
    })();
    return cachedBundle;
}

export async function testSealedUnit(endpointId: string): Promise<SealedUnit> {
    return sealUnit(await testBundle(), endpointId);
}

export interface RunEndpointOptions {
    unit: SealedUnit;
    input: RunInput;
    mode: RunMode;
    /** replay mode: the fixture to serve. */
    fixture?: Fixture;
    /** record mode: captured calls are pushed here. */
    sink?: RecordedCall[];
}

/**
 * Execute a compiled sealed unit through Engine.load — the per-endpoint test
 * pipeline. replay = zero network + test key; live/record = real fetch + env key.
 */
export async function runEndpoint(
    opts: RunEndpointOptions,
): Promise<RunCompleted> {
    let transport;
    switch (opts.mode) {
        case "replay": {
            if (!opts.fixture) {
                throw new Error("replay mode requires a fixture");
            }
            // shared-chain bindings (fixture strategy v2): fixture urls may
            // carry {{request.url}}/{{request.origin}} placeholders, bound
            // from THIS endpoint's compiled request
            const requestUrl = opts.unit.doc.request.url;
            transport = directTransport({
                params: () => Promise.resolve({ apiKey: "test-key" }),
                fetch: replayFetch(opts.fixture, {
                    "request.url": requestUrl,
                    "request.origin": new URL(requestUrl).origin,
                }),
            });
            break;
        }
        case "record": {
            if (!opts.sink) throw new Error("record mode requires a sink");
            transport = directTransport({
                params: envParamsResolver,
                fetch: recordingFetch(fetch, opts.sink),
            });
            break;
        }
        case "live":
            transport = directTransport({ params: envParamsResolver });
            break;
    }
    // replay: skip real pollAfterMs sleeps — async fixtures replay instantly.
    const engine = new Engine({
        transport,
        ...(opts.mode === "replay" ? { sleep: () => Promise.resolve() } : {}),
    });
    const loaded = await engine.load(opts.unit);
    return await loaded.run(opts.input);
}

/**
 * The PRE-RUN estimate of a sealed unit — the settle-side twin of
 * `runEndpoint`, so a connector can assert the promise it makes as well as the
 * bill it renders.
 *
 * No fixture and no mode: `usage.estimate` is a PURE hook over the validated
 * input, so there is nothing to replay. The transport rejects every call,
 * which turns an estimate that reaches for IO into a test failure rather than
 * a silent network hit (the same guard `deno task engine:estimate` uses).
 */
export async function estimateEndpoint(
    unit: SealedUnit,
    input: RunInput,
): Promise<Usage> {
    const loaded = await new Engine({
        transport: {
            execute: () =>
                Promise.reject(new Error("estimate is pure — no IO allowed")),
        },
    }).load(unit);
    return loaded.estimate(input);
}

/** Gate for live tests: `ignore: liveSkip("exa")`. */
export function liveSkip(providerSlug: string): boolean {
    const envVar = `${providerSlug.toUpperCase().replaceAll("-", "_")}_API_KEY`;
    return !Deno.env.get(envVar);
}
