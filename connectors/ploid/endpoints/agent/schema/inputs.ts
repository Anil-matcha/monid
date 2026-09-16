import { z } from "zod";

/** `POST /v1/agent` — the caller-facing subset of the vendor's ask
 *  request. `operation`, `memory`, `sources` are pinned by the doc's
 *  toRequest and `session_id` is never accepted: all tenants share one
 *  Ploid workspace, so those fields would reach shared state. */
export const zPloidAgentBody = z.strictObject({
    prompt: z.string().min(1).max(20_000).describe(
        "The research goal in plain language — one self-contained task " +
            "stating the outcome and the evidence standard, not a fixed " +
            "search sequence. Keep the names, companies, domains, dates, " +
            "and requested output shape explicit; ask for source URLs " +
            "when facts must be verified; request exhaustive depth only " +
            "when the task truly needs it. Example: 'Research the " +
            "current sales leadership at Retool. Return each person's " +
            "name, current title, LinkedIn URL when available, and " +
            "evidence URLs. Clearly label anything that cannot be " +
            "verified.'",
    ),
    max_acu: z.number().int().min(1).max(64).describe(
        "Compute ceiling for this task in ACU (1 ACU = USD 0.10 of agent " +
            "compute). Vendor default 2, range 1-64; raise it for deep " +
            "multi-entity research. Billing is the compute actually " +
            "used, never the ceiling.",
    ).optional(),
    output_schema: z.record(z.string(), z.any()).describe(
        "Optional JSON Schema (max 16,000 bytes) for a validated " +
            "machine-readable result, returned at data.structured_output. " +
            "Requires response_format 'standard' (the default); the " +
            "vendor rejects it with 'markdown'.",
    ).optional(),
    response_format: z.enum(["standard", "markdown"]).describe(
        "standard (default) = JSON envelope with output text and " +
            "artifacts; markdown = the synthesis as Markdown text.",
    ).optional(),
});
