import { z } from "zod";

/**
 * Display metadata shared by endpoints and providers, three lengths with
 * defined roles:
 *   - `summary`: ONE line — list views (catalog rows, `catalog endpoints`).
 *   - `description`: full capability text — inspect views and agent
 *     consumption (what it does, notable params, when to use it).
 *   - `notes`: operational CAVEATS — what a caller must know before calling,
 *     not what the endpoint is for. One entry = one standalone fact, rendered
 *     as one bullet (latency, result expiry, input shapes the vendor rejects,
 *     parameter combinations that are silently wrong rather than errors, and
 *     cross-field rules that cannot survive `z.toJSONSchema`). Display
 *     metadata only — no hook reads it, no engine behavior depends on it.
 *     A constraint about ONE input field belongs on that field's
 *     `.describe()`, never here.
 * (`tags` and `deprecated` were removed: nothing consumed them. tags returns
 * if search ever needs free-form labels; deprecated with a real deprecation
 * story.)
 */
export const zBaseMeta = z.strictObject({
    displayName: z.string().min(1),
    summary: z.string().min(1),
    description: z.string().optional(),
    /** Operational caveats. The compiled doc's notes CONCATENATE provider
     *  then endpoint (design add-meta-notes D1) — the one additive
     *  resolution in the doc, because a provider caveat and an endpoint
     *  caveat are both true at once. `.min(1)` on the array keeps `[]`
     *  unrepresentable: absent is the only way to say "no notes", so two
     *  note-less docs serialize identically. */
    notes: z.array(z.string().min(1)).min(1).optional(),
    docsUrl: z.url().optional(),
});
export type BaseMeta = z.infer<typeof zBaseMeta>;
