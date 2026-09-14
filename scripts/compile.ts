/**
 * deno task compiler:compile [--force] [--frozen-meta] [--publish <tag>]
 *
 * Compiles ALL connector Defs into the flat bundle (docs + fnTable) under
 * the gitignored .output/ cache — always the whole repo, one artifact
 * (provider/endpoint lookups read the compiled bundle; design D28). With
 * --publish, also emits the split publish tree (.output/publish/) that CI
 * tars and attaches to the catalog-v* GitHub Release; nothing compiled is
 * checked in.
 */
import { Command } from "@cliffy/command";
import { compileToOutput, emitPublish } from "./lib.ts";

const { options } = await new Command()
    .name("compiler:compile")
    .description(
        "Compile all connector defs into the bundle (cached under .output/).",
    )
    .option("--force", "Ignore the cache.")
    .option(
        "--frozen-meta",
        "Pin catalogVersion/generatedAt (CI determinism compare).",
    )
    .option(
        "--publish <tag:string>",
        "Also emit the split publish tree (.output/publish/) for this " +
            "catalog-v* tag — the artifact the hosted catalog ingests.",
    )
    .parse(Deno.args);

const { bundle, outputPath, cacheHit } = await compileToOutput({
    force: options.force,
    frozenMeta: options.frozenMeta,
});

console.log(
    `${cacheHit ? "cache hit" : "compiled"}: ${outputPath}\n` +
        `  minEngineVersion: ${bundle.minEngineVersion}\n` +
        `  providers: ${Object.keys(bundle.providers).join(", ")}\n` +
        `  endpoints: ${Object.keys(bundle.endpoints).join(", ")}\n` +
        `  fnTable entries: ${Object.keys(bundle.fnTable).length}`,
);

if (options.publish) {
    // Strict: the tag is used verbatim as a directory name and S3 key
    // segment, so no `/` or other path-hostile characters.
    if (
        !/^catalog-v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(options.publish)
    ) {
        console.error(
            `--publish expects a catalog-v<semver> tag ` +
                `(e.g. catalog-v1.2.3), got: ${options.publish}`,
        );
        Deno.exit(1);
    }
    const emit = await emitPublish(bundle, options.publish);
    console.log(
        `publish emit: ${emit.publishDir}\n` +
            `  manifest: ${emit.manifestKey}\n` +
            `  docs: ${emit.docCount}, fns: ${emit.fnCount}`,
    );
}
