/**
 * emitPublish: the split, content-addressed publish tree
 * (.output/publish/) that the catalog-v* release tarball carries and the
 * hosted catalog ingests. Pins the two invariants pooling depends on:
 *
 *   1. every object file is addressed by the hash of the content it
 *      stores (docs: docHash over the doc minus its `hash` field; fns:
 *      hash of the FULL stored entry — NOT the fnTable src-only key),
 *   2. re-emitting the same bundle is byte-identical.
 */
import { assert, assertEquals } from "@std/assert";
import { join } from "@std/path";
import { walk } from "@std/fs";
import { z } from "zod";
import {
    contractConfig,
    defineEndpoint,
    defineProvider,
    docHash,
    type Json,
    presets,
    sha256Hex,
    stableStringify,
} from "@shared/core";
import { compileBundle } from "@shared/compiler";
import { emitPublish } from "./lib.ts";

const OPTS = {
    compilerVersion: "0.1.0",
    builtWithEngineVersion: "0.1.0",
    catalogVersion: "0.0.0-test",
    generatedAt: "1970-01-01T00:00:00.000Z",
    leafCategories: [{ id: "demo-cat", displayName: "Demo Category" }],
} as const;

function makeBundle() {
    const provider = defineProvider(
        {
            name: "demo",
            meta: { displayName: "Demo", summary: "A demo provider." },
            auth: { inject: presets.auth.header("x-demo-key") },
            request: { baseUrl: "https://api.demo.test" },
            usage: {
                model: {
                    kind: "PER_CALL",
                    consumes: { credit: "default", amount: 0.01 },
                },
                credits: { default: { label: "Demo credits" } },
            },
        } as Parameters<typeof defineProvider>[0],
    );
    const def = defineEndpoint(
        {
            meta: {
                displayName: "Demo Search",
                summary: "Searches.",
                categories: ["demo-cat"],
            },
            request: { method: "POST", path: "/search" },
            input: { schema: { body: z.object({ q: z.string() }) } },
        } as Parameters<typeof defineEndpoint>[0],
    );
    return compileBundle(
        [{ provider, endpoints: [{ name: "search", def }] }],
        OPTS,
    );
}

/** relative path → file content, for whole-tree comparisons. */
async function treeSnapshot(dir: string): Promise<Record<string, string>> {
    const files: Record<string, string> = {};
    for await (const entry of walk(dir, { includeDirs: false })) {
        files[entry.path.slice(dir.length + 1)] = await Deno.readTextFile(
            entry.path,
        );
    }
    return files;
}

Deno.test("emitPublish: layout, manifest shape, content-addressed objects", async () => {
    const bundle = await makeBundle();
    const tag = "catalog-v1.2.3";
    const dir = await Deno.makeTempDir({ prefix: "publish-test-" });
    try {
        const emit = await emitPublish(bundle, tag, dir);
        assertEquals(emit.publishDir, dir);
        assertEquals(emit.manifestKey, `publishes/${tag}/manifest.json`);

        const manifest = JSON.parse(
            await Deno.readTextFile(join(dir, emit.manifestKey)),
        );
        assertEquals(manifest.catalogVersion, tag);
        assertEquals(manifest.specVersion, contractConfig.schema.specVersion);
        assertEquals(manifest.minEngineVersion, bundle.minEngineVersion);
        assertEquals(manifest.generatedAt, bundle.generatedAt);
        assertEquals(manifest.taxonomy, bundle.taxonomy);
        assertEquals(
            manifest.docs.length,
            Object.keys(bundle.providers).length +
                Object.keys(bundle.endpoints).length,
        );
        assertEquals(manifest.fns.length, Object.keys(bundle.fnTable).length);
        assert(manifest.fns.length > 0, "expected fnTable entries");
        assertEquals(emit.docCount, manifest.docs.length);
        assertEquals(emit.fnCount, manifest.fns.length);

        // Doc objects: the object NAME re-derives from the stored content
        // (docHash strips the embedded `hash` field before hashing).
        for (const doc of manifest.docs) {
            const parsed = JSON.parse(
                await Deno.readTextFile(join(dir, doc.key)),
            ) as Record<string, Json>;
            assertEquals(await docHash(parsed), doc.hash);
            assert(
                doc.key ===
                    `publishes/objects/sha256/${
                        doc.hash.replace("sha256:", "")
                    }.json`,
            );
        }

        // Fn objects: addressed by the hash of the FULL stored entry —
        // the src-only fnTable key stays the logical id in the manifest.
        for (const fn of manifest.fns) {
            const raw = await Deno.readTextFile(join(dir, fn.objectKey));
            const rehash = await sha256Hex(stableStringify(JSON.parse(raw)));
            assertEquals(
                fn.objectKey,
                `publishes/objects/sha256/${rehash}.json`,
            );
            assert(
                bundle.fnTable[fn.key] !== undefined,
                `manifest fn key not in fnTable: ${fn.key}`,
            );
            assertEquals(
                raw,
                stableStringify(bundle.fnTable[fn.key] as unknown as Json),
            );
        }

        // latest.json is the pointer.
        assertEquals(
            JSON.parse(await Deno.readTextFile(join(dir, "latest.json"))),
            { catalogVersion: tag, manifestKey: emit.manifestKey },
        );
    } finally {
        await Deno.remove(dir, { recursive: true });
    }
});

Deno.test("emitPublish is deterministic (re-emit byte-identical)", async () => {
    const bundle = await makeBundle();
    const tag = "catalog-v0.0.1";
    const [a, b] = await Promise.all([
        Deno.makeTempDir({ prefix: "publish-a-" }),
        Deno.makeTempDir({ prefix: "publish-b-" }),
    ]);
    try {
        await emitPublish(bundle, tag, a);
        await emitPublish(bundle, tag, b);
        assertEquals(await treeSnapshot(a), await treeSnapshot(b));
    } finally {
        await Deno.remove(a, { recursive: true });
        await Deno.remove(b, { recursive: true });
    }
});
