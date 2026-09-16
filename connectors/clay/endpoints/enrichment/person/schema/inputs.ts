import { z } from "zod";
import { zPersonSocialProfileField } from "../../../../schema/common.ts";

/**
 * Clay-managed "Enrich person" function inputs — the faithful vendor
 * mirror (upstream keys verbatim, optionality only): Clay declares NEITHER
 * field required.
 *
 * But a body with neither identifier runs — and can draw for — a search
 * for nobody, so OUR rule is "at least one". Being ours, it belongs at the
 * BINDING, not here (design D25): `endpoint.ts` binds the two-arm union
 * that compiles to `anyOf`, and `AT_LEAST_ONE_IDENTIFIER` is exported for
 * it to describe itself with.
 *
 * NOT a `.refine`: `z.toJSONSchema` drops refinements SILENTLY (no throw,
 * no warning — probed), and the engine validates the compiled JSON Schema
 * with ajv, never this object. A refined mirror would read as guarded and
 * compile to exactly the shape below (design D13).
 */
export const AT_LEAST_ONE_IDENTIFIER =
    "Provide at least one of 'Professional Profile URL' or 'Email' — a " +
    "body with neither resolves nobody.";

export const zEnrichPersonBody = z.object({
    "Professional Profile URL": zPersonSocialProfileField.optional(),
    "Email": z.string().min(1).optional().describe(
        "The person's email address (work or personal).",
    ),
}).strict();
