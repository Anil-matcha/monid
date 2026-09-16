import { z } from "zod";
import {
    zAuditMetadata,
    zThreatProtectionOverride,
    zWebhook,
} from "../../../schema/common.ts";

/** `POST /v2/agent` request body — the OpenAPI schema, optionality only. */
export const zAgentBody = z.object({
    prompt: z.string().max(10_000).describe(
        "What data to find and extract.",
    ).meta({
        examples: ["Find the pricing tiers and per-seat cost on acme.com"],
    }),
    urls: z.array(z.url()).optional().describe(
        "Constrain the agent to these URLs.",
    ),
    schema: z.record(z.string(), z.unknown()).optional().describe(
        "JSON Schema to shape the extracted data.",
    ),
    maxCredits: z.number().min(1).optional().describe(
        "Maximum credits the agent may spend on this task (vendor default " +
            "2500). Agent pricing is dynamic — this ceiling is what bounds " +
            "the run, so state the budget you actually want.",
    ),
    strictConstrainToURLs: z.boolean().optional().describe(
        "Visit only the URLs provided in `urls` (default false).",
    ),
    model: z.enum(["spark-2", "spark-1-mini", "spark-1-pro"]).optional()
        .describe(
            "Model preset (default 'spark-2'). The Spark 1 names are " +
                "deprecated and route to spark-2.",
        ),
    effort: z.enum(["low", "medium", "high"]).optional().describe(
        "Reasoning budget. Every run executes on spark-2, so effort can be " +
            "sent with or without model.",
    ),
    webhook: zWebhook.optional(),
    auditMetadata: zAuditMetadata.optional(),
    threatProtection: zThreatProtectionOverride.optional(),
});
