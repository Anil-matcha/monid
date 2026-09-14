import { join } from "@std/path";
import { ensureDir, walk } from "@std/fs";
import {
    type Bundle,
    contractConfig,
    loadCategoryRegistry,
    loadConnectorDefs,
    sha256Hex,
    stableStringify,
} from "@shared/core";
import type { Json } from "@shared/core";
import { compileBundle } from "@shared/compiler";

export const REPO_ROOT = new URL("../", import.meta.url).pathname;
export const OUTPUT_DIR = join(REPO_ROOT, ".output");

/** Versions read as DATA (scripts do not need the packages' code). */
async function versionOf(pkgDir: string): Promise<string> {
    const denoJson = JSON.parse(
        await Deno.readTextFile(join(REPO_ROOT, pkgDir, "deno.json")),
    );
    return denoJson.version as string;
}
export const engineVersion = (): Promise<string> => versionOf("engine");
export const compilerVersion = (): Promise<string> =>
    versionOf("shared/compiler");

/** Cache key: sha256 over every compile input + versions. */
export async function inputsKey(versions: string[]): Promise<string> {
    const parts: string[] = [`versions:${versions.join(",")}`];
    const roots = ["connectors", "shared/core", "shared/compiler"];
    const files: string[] = [join(REPO_ROOT, "config.yml")];
    for (const root of roots) {
        for await (
            const entry of walk(join(REPO_ROOT, root), {
                includeDirs: false,
                exts: [".ts", ".json"],
            })
        ) {
            files.push(entry.path);
        }
    }
    files.sort();
    for (const file of files) {
        parts.push(`${file}:${await sha256Hex(await Deno.readTextFile(file))}`);
    }
    return await sha256Hex(parts.join("\n"));
}

/**
 * The ONE place the user-facing endpoint id form ("exa#search") is split —
 * needed only where the two halves matter separately (record's fixture
 * path). Bundle lookups take the id directly (sealUnit, inspectEndpoint).
 */
export function parseEndpointId(
    id: string,
): { provider: string; endpoint: string } {
    const [provider, endpoint, ...rest] = id.split("#");
    if (!provider || !endpoint || rest.length > 0) {
        throw new Error(`expected <provider>#<endpoint>, got: ${id}`);
    }
    return { provider, endpoint };
}

async function gitSha(): Promise<string> {
    try {
        const output = await new Deno.Command("git", {
            args: ["rev-parse", "--short", "HEAD"],
            cwd: REPO_ROOT,
            stdout: "piped",
            stderr: "null",
        }).output();
        if (output.code === 0) {
            return new TextDecoder().decode(output.stdout).trim();
        }
    } catch { /* git unavailable */ }
    return "dev";
}

export interface CompileResult {
    bundle: Bundle;
    outputPath: string;
    cacheHit: boolean;
}

/**
 * Compile through the .output/ cache (gitignored). Key = inputs hash +
 * engine/compiler versions; catalogVersion/generatedAt metadata never
 * participate in the key. `frozenMeta` pins metadata for determinism
 * comparisons (CI double-compile).
 */
export async function compileToOutput(
    opts: { force?: boolean; frozenMeta?: boolean } = {},
): Promise<CompileResult> {
    const [engine, compiler] = await Promise.all([
        engineVersion(),
        compilerVersion(),
    ]);
    const key = await inputsKey([engine, compiler]);
    // ALWAYS the whole repo → ONE artifact. Lookups (provider/endpoint) read
    // the compiled bundle — never re-load defs (design D28).
    const outputPath = join(OUTPUT_DIR, "catalog.json");
    const keyPath = `${outputPath}.key`;

    if (!opts.force) {
        try {
            const cachedKey = await Deno.readTextFile(keyPath);
            if (cachedKey === key) {
                const bundle = JSON.parse(
                    await Deno.readTextFile(outputPath),
                ) as Bundle;
                return { bundle, outputPath, cacheHit: true };
            }
        } catch { /* miss */ }
    }

    const connectorsDir = join(REPO_ROOT, "connectors");
    const [connectors, leafCategories] = await Promise.all([
        loadConnectorDefs(connectorsDir),
        loadCategoryRegistry(connectorsDir),
    ]);
    const bundle = await compileBundle(connectors, {
        compilerVersion: compiler,
        builtWithEngineVersion: engine,
        catalogVersion: opts.frozenMeta
            ? "0.0.0-frozen"
            : `0.0.0-git.${await gitSha()}`,
        generatedAt: opts.frozenMeta
            ? "1970-01-01T00:00:00.000Z"
            : new Date().toISOString(),
        leafCategories,
    });
    await ensureDir(OUTPUT_DIR);
    await Deno.writeTextFile(
        outputPath,
        JSON.stringify(bundle, null, 2) + "\n",
    );
    await Deno.writeTextFile(keyPath, key);
    return { bundle, outputPath, cacheHit: false };
}

/**
 * Locate an endpoint's SOURCE directory under
 * `connectors/<provider>/endpoints/**` — endpoints may sit inside GROUP
 * directories (the platform grouping, e.g. apify/endpoints/amazon/…), and
 * since design D22 the endpoint IDENTITY is the def's native path, not
 * the folder name. `endpoint` is the id tail ("apidojo/tweet-scraper",
 * "v1/company/search", "search"); matched in order:
 *   1. a pinned `endpoint: "/<identity>"` field in the def source,
 *   2. a `request.path` whose trailing-slash-stripped form is the
 *      identity (the default-identity rule),
 *   3. the LEAF directory name (pre-D22 convention — scaffold refreshes
 *      still address dirs directly).
 */
export async function findEndpointDir(
    provider: string,
    endpoint: string,
): Promise<string | undefined> {
    const endpointsDir = join(REPO_ROOT, "connectors", provider, "endpoints");
    let leafMatch: string | undefined;
    for await (
        const entry of walk(endpointsDir, {
            includeFiles: true,
            match: [/endpoint\.ts$/],
        })
    ) {
        const dir = entry.path.slice(0, -"/endpoint.ts".length);
        const source = await Deno.readTextFile(entry.path);
        if (source.includes(`endpoint: "/${endpoint}"`)) return dir;
        if (
            source.includes(`path: "/${endpoint}"`) ||
            source.includes(`path: "/${endpoint}/"`)
        ) {
            return dir;
        }
        if (dir.endsWith(`/${endpoint}`)) leafMatch = dir;
    }
    return leafMatch;
}

// ── publish emit (.output/publish/) ─────────────────────────────────────
//
// The split, content-addressed layout the hosted catalog service ingests
// from S3 (the manifest schema is mirrored as zPublishManifest in
// monid-services' shared/models/catalog/publish.ts — the publish job's
// download-verify step validates against it, so drift fails loudly there):
//
//   .output/publish/
//   ├── latest.json                          ← pointer; uploaded LAST by CI
//   └── publishes/
//       ├── <tag>/manifest.json
//       └── objects/sha256/<hex>.json        ← doc + fn payloads, pooled
//
// Objects are content-addressed and pooled across tags, so `aws s3 sync`
// moves only genuinely new content and the catalog's diff ingest skips
// everything it has already embedded.

export const PUBLISH_DIR = join(OUTPUT_DIR, "publish");

const objectRelKey = (hash: string) =>
    `publishes/objects/sha256/${hash.replace(/^sha256:/, "")}.json`;

export interface PublishEmit {
    publishDir: string;
    manifestKey: string;
    docCount: number;
    fnCount: number;
}

/**
 * Write the publish tree for `tag` from a compiled bundle. The tag IS the
 * catalogVersion (pushing `catalog-v*` is the publish button); the bundle's
 * own git-sha catalogVersion stamp is compile metadata and does not ride
 * into the manifest.
 *
 * `publishDir` overrides the output root (tests emit into a temp dir).
 */
export async function emitPublish(
    bundle: Bundle,
    tag: string,
    publishDir: string = PUBLISH_DIR,
): Promise<PublishEmit> {
    await Deno.remove(publishDir, { recursive: true }).catch(() => {});
    const objectsDir = join(publishDir, "publishes", "objects", "sha256");
    const manifestDir = join(publishDir, "publishes", tag);
    await ensureDir(objectsDir);
    await ensureDir(manifestDir);

    const writeObject = async (hash: string, value: Json) => {
        await Deno.writeTextFile(
            join(publishDir, objectRelKey(hash)),
            stableStringify(value),
        );
    };

    const docs: Array<Record<string, Json>> = [];
    for (const doc of Object.values(bundle.providers)) {
        await writeObject(doc.hash, doc as unknown as Json);
        docs.push({
            id: doc.name,
            kind: "provider",
            provider: doc.name,
            hash: doc.hash,
            key: objectRelKey(doc.hash),
        });
    }
    for (const doc of Object.values(bundle.endpoints)) {
        await writeObject(doc.hash, doc as unknown as Json);
        docs.push({
            id: doc.id,
            kind: "endpoint",
            provider: doc.provider,
            hash: doc.hash,
            key: objectRelKey(doc.hash),
        });
    }
    // The fnTable key hashes only the normalized `src`, but the stored
    // object is the FULL entry (api/kind/src/provenance) — provenance can
    // change while src stays identical. Pooled objects must be addressed by
    // the bytes they contain, so the STORAGE key is the hash of the whole
    // entry; the fnTable key stays the logical id in the manifest.
    const fns: Array<Record<string, Json>> = [];
    for (const [key, entry] of Object.entries(bundle.fnTable)) {
        const value = entry as unknown as Json;
        const objectHash = `sha256:${await sha256Hex(stableStringify(value))}`;
        await writeObject(objectHash, value);
        fns.push({ key, objectKey: objectRelKey(objectHash) });
    }

    const manifestKey = `publishes/${tag}/manifest.json`;
    const manifest: Json = {
        catalogVersion: tag,
        specVersion: contractConfig.schema.specVersion,
        minEngineVersion: bundle.minEngineVersion,
        generatedAt: bundle.generatedAt,
        toolchain: bundle.toolchain as unknown as Json,
        docs: docs as unknown as Json,
        fns: fns as unknown as Json,
        taxonomy: bundle.taxonomy as unknown as Json,
    };
    await Deno.writeTextFile(
        join(manifestDir, "manifest.json"),
        stableStringify(manifest),
    );
    await Deno.writeTextFile(
        join(publishDir, "latest.json"),
        stableStringify({ catalogVersion: tag, manifestKey }),
    );
    return {
        publishDir,
        manifestKey,
        docCount: docs.length,
        fnCount: fns.length,
    };
}
