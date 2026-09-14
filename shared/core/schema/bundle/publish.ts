import { z } from "zod";
import { zDocHash, zEndpointId, zFnId, zProviderName } from "../common/ids.ts";
import { zCategoryId } from "../common/ids.ts";
import { zSemverString } from "../common/ids.ts";

/**
 * The PUBLISH ARTIFACT contract — the split, content-addressed layout the
 * compiler emits (`.output/publish/`, tarred onto the GitHub Release) and
 * the hosted catalog service ingests from S3.
 *
 * This is the ONE definition both sides share: the emitter (`emitPublish`,
 * scripts/lib.ts) validates its output against it, and monid-services
 * consumes it through its vendored `@shared/connector-core` snapshot — the
 * verify step (download-verify) and the ingest pipeline parse with THIS
 * schema, so emit and ingest cannot drift.
 *
 * Layout (bucket-root-relative; the release tarball mirrors it):
 *   publishes/latest.json                       ← pointer, uploaded LAST
 *   publishes/<catalogVersion>/manifest.json
 *   publishes/objects/sha256/<hex>.json         ← doc + fn payloads, pooled
 *
 * The `objects/` pool is shared across tags: `aws s3 sync` moves only files
 * that don't exist yet, and the catalog's content-addressed diff skips
 * anything already ingested — an unchanged doc costs zero bytes and zero
 * embeddings on every subsequent publish.
 */

export const PUBLISHES_PREFIX = "publishes";
export const LATEST_POINTER_KEY = `${PUBLISHES_PREFIX}/latest.json`;

export function manifestKeyFor(catalogVersion: string): string {
    return `${PUBLISHES_PREFIX}/${catalogVersion}/manifest.json`;
}

/** `sha256:<hex>` → pooled object key. */
export function objectKeyFor(hash: string): string {
    const hex = hash.replace(/^sha256:/, "");
    return `${PUBLISHES_PREFIX}/objects/sha256/${hex}.json`;
}

/** One doc (endpoint or provider) in the publish. */
export const zPublishDocEntry = z.object({
    /** "exa#search" for endpoints; "exa" for providers. */
    id: z.union([zEndpointId, zProviderName]),
    kind: z.enum(["endpoint", "provider"]),
    provider: zProviderName,
    /** The doc's self-carried content hash (doc.hash). */
    hash: zDocHash,
    /** Bucket-root-relative object key holding the doc JSON. */
    key: z.string().min(1),
}).strict();
export type PublishDocEntry = z.infer<typeof zPublishDocEntry>;

/** One interned $fn entry in the publish. */
export const zPublishFnEntry = z.object({
    /** The fnTable key (content id of the normalized source). */
    key: zFnId,
    /** Bucket-root-relative object key holding the FnEntry JSON. */
    objectKey: z.string().min(1),
}).strict();
export type PublishFnEntry = z.infer<typeof zPublishFnEntry>;

/**
 * publishes/<tag>/manifest.json — everything needed to (a) verify a
 * downloaded artifact file-by-file, (b) diff against an existing catalog,
 * and (c) reassemble the EXACT zBundle for full invariant re-validation.
 * Bundle-level fields (generatedAt, toolchain, taxonomy, minEngineVersion)
 * ride along verbatim so assembly is lossless.
 */
export const zPublishManifest = z.object({
    /** The git tag, e.g. "catalog-v0.2.0" — the publish identity. */
    catalogVersion: z.string().min(1),
    /** Doc FORMAT version — the consumer's ingest gate. */
    specVersion: zSemverString,
    minEngineVersion: zSemverString,
    generatedAt: z.string().min(1),
    toolchain: z.object({
        compilerVersion: zSemverString,
        builtWithEngineVersion: zSemverString,
    }).strict(),
    docs: z.array(zPublishDocEntry),
    fns: z.array(zPublishFnEntry),
    taxonomy: z.object({
        leaves: z.array(z.object({
            id: zCategoryId,
            displayName: z.string().min(1),
            description: z.string().optional(),
        }).strict()),
        membership: z.record(zCategoryId, z.array(zEndpointId)),
    }).strict(),
}).strict();
export type PublishManifest = z.infer<typeof zPublishManifest>;

/** publishes/latest.json — the current-publish pointer, written LAST. */
export const zLatestPointer = z.object({
    catalogVersion: z.string().min(1),
    manifestKey: z.string().min(1),
}).strict();
export type LatestPointer = z.infer<typeof zLatestPointer>;

/**
 * The publish EVENT contract — emitted by the monid-services GitLab
 * catalog-publish job onto each enabled environment's default EventBridge
 * bus after the S3 upload; that environment's rule invokes the catalog
 * service, which parses `detail` with `zCatalogPublishedDetail`. Defined
 * here so emitter and consumer share one source of truth (the CDK rule
 * hardcodes the two strings with a pointer comment — the node toolchain
 * cannot import this workspace).
 */
export const CATALOG_PUBLISHED_EVENT = {
    source: "monid.catalog",
    detailType: "monid.catalog.published",
} as const;

export const zCatalogPublishedDetail = z.object({
    tag: z.string().min(1),
    manifestKey: z.string().min(1),
}).strict();
export type CatalogPublishedDetail = z.infer<typeof zCatalogPublishedDetail>;
