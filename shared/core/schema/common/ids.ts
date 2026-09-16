import { z } from "zod";

export const zProviderName = z.string().regex(
    /^[a-z0-9][a-z0-9-]*$/,
    "provider name must be lowercase kebab-case",
);
export type ProviderName = z.infer<typeof zProviderName>;

export const zEndpointName = z.string().regex(
    /^[a-z0-9][a-z0-9-]*$/,
    "endpoint FOLDER name must be lowercase kebab-case",
);
export type EndpointName = z.infer<typeof zEndpointName>;

/**
 * ONE path segment of a public endpoint identity: a lowercase literal, OR a
 * `{param}` PLACEHOLDER for a path parameter.
 *
 * The placeholder case exists so a resource-style endpoint can be identified
 * by the vendor's ACTUAL path — `firecrawl#crawl/{id}` is the endpoint we
 * call, so it is the endpoint the caller sees. Before this, a placeholder had
 * to be pinned away to an invented segment (fundable's `/deals/{id}` →
 * `/deal`), which put a name in the catalog that appears nowhere in the
 * vendor's API.
 *
 * NOTE the consequence: the parameter NAME is part of the identity, so
 * renaming `{id}` → `{jobId}` is a breaking identity change, exactly as
 * renaming a literal segment would be.
 */
const ID_SEGMENT = String.raw`(?:[a-z0-9][a-z0-9._~-]*|\{[a-z][a-zA-Z0-9_]*\})`;

/**
 * The PUBLIC endpoint identity — a NATIVE path (design D22, v1 parity:
 * `"/search"`, `"/v1/company/enrichment"`, `"/apidojo/tweet-scraper"`,
 * `"/crawl/{id}"`). Defaults to `request.path` (trailing slashes stripped);
 * declared explicitly when the native path is transport plumbing (apify's
 * `/v2/acts/{owner}~{name}/runs` → the actor slug path), empty (tinyfish's
 * per-endpoint baseUrls), or simply worth stating at the call site. Folder
 * names are ORGANIZATIONAL only — identity lives in the def, never the
 * filesystem.
 */
export const zEndpointPath = z.string().regex(
    new RegExp(`^/${ID_SEGMENT}(?:/${ID_SEGMENT})*$`),
    "endpoint must be a lowercase native path like /search, /owner/name, " +
        "or /crawl/{id}",
);
export type EndpointPath = z.infer<typeof zEndpointPath>;

/** "<provider>#<endpoint-path minus its leading slash>" — e.g.
 *  "exa#search", "apify#apidojo/tweet-scraper", "firecrawl#crawl/{id}".
 *  Everything left of the FIRST "#" is the provider; the rest is the
 *  endpoint path. */
export const zEndpointId = z.string().regex(
    new RegExp(`^[a-z0-9][a-z0-9-]*#${ID_SEGMENT}(?:/${ID_SEGMENT})*$`),
    "endpoint id must be <provider>#<endpoint-path-sans-slash>",
);
export type EndpointId = z.infer<typeof zEndpointId>;

/** Single-segment LEAF category slug (flat namespace, v1-compatible). */
export const zCategoryId = z.string().regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'category must be a single lowercase slug id like "web-search"',
);
export type CategoryId = z.infer<typeof zCategoryId>;

export const zSemverString = z.string().regex(
    /^\d+\.\d+\.\d+$/,
    "must be a plain semver (MAJOR.MINOR.PATCH)",
);
export type SemverString = z.infer<typeof zSemverString>;

/**
 * Content ids/hashes are ALGORITHM-AGNOSTIC by NAME (like zProviderName /
 * zEndpointId): the `sha256:` prefix in the VALUE is the migration mechanism
 * — a future `blake3:<hex>` id would validate under the same interface
 * without renaming anything. Today both accept sha256 only.
 */
export const zFnId = z.string().regex(
    /^sha256:[0-9a-f]{64}$/,
    "fn id must be <algorithm>:<hex> (currently sha256:<64 hex>)",
);
export type FnId = z.infer<typeof zFnId>;

export const zDocHash = z.string().regex(
    /^sha256:[0-9a-f]{64}$/,
    "doc hash must be <algorithm>:<hex> (currently sha256:<64 hex>)",
);
export type DocHash = z.infer<typeof zDocHash>;
