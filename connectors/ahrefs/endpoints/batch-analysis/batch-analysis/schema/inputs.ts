import { z } from "zod";
import { zCountry, zMode, zProtocol } from "../../../../schema/common.ts";

/** The fixed `select` list — 21 API units per row (design D4). */
export const BATCH_ANALYSIS_FIELDS = [
    "url",
    "mode",
    "domain_rating",
    "ahrefs_rank",
    "backlinks",
    "org_keywords",
    "refdomains",
    "org_traffic",
] as const;

/** One Batch Analysis target. Upstream requires all three per target —
 *  omitting `protocol` is a 400 — so the vendor defaults are applied at
 *  the binding, per target. */
export const zBatchTarget = z.object({
    url: z.string().min(1).describe("The target: a domain or a URL."),
    mode: zMode.optional(),
    protocol: zProtocol.optional(),
}).strict();

/** POST /batch-analysis/batch-analysis body (ported from v1). */
export const zBatchAnalysisBody = z.object({
    targets: z.array(zBatchTarget).min(1).max(100).describe(
        "Targets to analyze (up to 100; one billed row per target).",
    ),
    country: zCountry.optional(),
}).strict();
