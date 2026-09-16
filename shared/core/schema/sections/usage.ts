import { z } from "zod";
import {
    zUsageConsolidateFn,
    zUsageEstimateFn,
    zUsageEvidenceFn,
} from "../hooks/mod.ts";
import { zCredits, zUsageModel } from "../usage/model/mod.ts";

/**
 * Usage section — SHARED by EndpointDef and ProviderDef (subclassing,
 * design D27: the PROVIDER states the default, the ENDPOINT overrides
 * only what diverges):
 *   - `model`: the billing-shape + RATE-CARD declaration (usage/model/) —
 *     inline DATA on the compiled doc (never a fn), so catalogs can price
 *     without executing anything. Must RESOLVE for every endpoint
 *     (endpoint ?? provider — compile error if neither): every doc
 *     declares what is chargeable.
 *   - `credits`: the credit systems the doc's lines drain (design D26,
 *     revised D6) — declared INDEPENDENTLY of the rate card, resolving
 *     KEY-WISE endpoint over provider (the D20 rule: a provider declares
 *     its pool SET once — single-pool providers name it `default` — and
 *     an endpoint adds or restates only what diverges). Every billable
 *     line's `consumes.credit` must reference a resolved id; a PROVIDER
 *     pool must be drained by at least ONE endpoint, an ENDPOINT pool by
 *     that endpoint (compile-checked). FREE docs need none.
 *   - `estimate`: the PRE-RUN quantities promise (hooks/estimate.ts) —
 *     validated input → `{counts}` with the model's metered keys.
 *   - `evidence`: the POST-RUN quantities settle (hooks/usage-evidence.ts)
 *     — RAW envelope → `{counts}`, estimate's settle-side twin.
 *     Both must RESOLVE when the model has METERED lines; for FREE/flat
 *     models the compiler synthesizes the one lawful `() => ({counts:{}})`.
 *   - `consolidate`: the VENDOR-METER fn (hooks/usage-consolidate.ts) —
 *     lifts the vendor's own consumed-credits number out of the payload
 *     (`{credits, output?}`). OPTIONAL: not every vendor reports one;
 *     typically provider-level (where the meter lives is a provider-wide
 *     fact).
 */
export const zUsageSection = z.strictObject({
    model: zUsageModel.optional(),
    credits: zCredits.optional(),
    estimate: zUsageEstimateFn.optional(),
    evidence: zUsageEvidenceFn.optional(),
    consolidate: zUsageConsolidateFn.optional(),
});
export type UsageSection = z.infer<typeof zUsageSection>;
