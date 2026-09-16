/**
 * Contract configuration — the `schema:` and `compiler:` sections of the
 * top-level config.yml, loaded OVERRIDE-FREE (no env vars, no stage
 * sections, unlike @shared/app-config): bundle bytes must be a pure function
 * of repo content, or reproducible hashing and the CI double-compile
 * determinism check die. `logging:` subtrees inside these sections are
 * TOOLING and are ignored here (read via @shared/app-config by their owners).
 *
 * Packaging note: read relative to this file (repo root); a published package
 * must ship config.yml alongside.
 */
import { parse as parseYaml } from "@std/yaml";
import { z } from "zod";
import { parseSchema } from "./schema/parse.ts";

const zSemverRaw = z.string().regex(/^\d+\.\d+\.\d+$/);
const zIgnoredLogging = z.unknown().optional();

const zContractSections = z.object({
    schema: z.object({
        spec_version: zSemverRaw,
        json_schema_dialect: z.literal("2020-12"),
        fn_src_max_bytes: z.number().int().positive(),
        // Declared FORMAT/ABI facts (not computed — each is "the oldest
        // engine that understands X", a historical fact set when X changes).
        doc_format_since: zSemverRaw,
        fn_abi_since: zSemverRaw,
        async_since: zSemverRaw,
        state_max_bytes: z.number().int().positive(),
        logging: zIgnoredLogging,
    }).strict(),
    compiler: z.object({
        doc_size_warn_bytes: z.number().int().positive(),
        doc_size_fail_bytes: z.number().int().positive(),
        defaults: z.object({
            request_timeout_ms: z.number().int().positive(),
            run_timeout_ms: z.number().int().positive(),
            poll_interval_ms: z.number().int().positive(),
        }).strict(),
        logging: zIgnoredLogging,
    }).strict(),
});

function loadContract(): z.infer<typeof zContractSections> {
    const text = Deno.readTextFileSync(
        new URL("../../config.yml", import.meta.url),
    );
    const raw = parseYaml(text) as Record<string, unknown>;
    return parseSchema(zContractSections, {
        schema: raw.schema,
        compiler: raw.compiler,
    }, "config.yml (contract sections)");
}

const loaded = loadContract();

/** Frozen, camel-cased view of the contract sections. */
export const contractConfig = Object.freeze({
    schema: Object.freeze({
        specVersion: loaded.schema.spec_version,
        jsonSchemaDialect: loaded.schema.json_schema_dialect,
        fnSrcMaxBytes: loaded.schema.fn_src_max_bytes,
        /** Oldest engine that understands the current doc format (minEngineVersion floor). */
        docFormatSince: loaded.schema.doc_format_since,
        /** Engine release of the current hook ABI — stamped as fn entries' `api`. */
        fnAbiSince: loaded.schema.fn_abi_since,
        /** Engine release of the lifecycle (async) hook family — stamped as
         *  lifecycle fn entries' `api` (docs carrying a lifecycle floor here). */
        asyncSince: loaded.schema.async_since,
        /** Hard engine cap on serialized lifecycle state bytes. */
        stateMaxBytes: loaded.schema.state_max_bytes,
    }),
    compiler: Object.freeze({
        docSizeWarnBytes: loaded.compiler.doc_size_warn_bytes,
        docSizeFailBytes: loaded.compiler.doc_size_fail_bytes,
        defaultTimeouts: Object.freeze({
            requestMs: loaded.compiler.defaults.request_timeout_ms,
            runMs: loaded.compiler.defaults.run_timeout_ms,
            pollMs: loaded.compiler.defaults.poll_interval_ms,
        }),
    }),
});
export type ContractConfig = typeof contractConfig;
