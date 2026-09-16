import { z } from "zod";
import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zProjectAiNewsQueryParams } from "./schema/inputs.ts";

/**
 * GET /project/ai-news — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Project AI News",
        summary: "AI-generated news and signal analysis for a project.",
        description: "AI-generated news and signal analysis for a project. " +
            "Each item includes title, summary, TL; DR, signal type, " +
            "and source URLs. Signal types returned: price_analysis, " +
            "funding. Social/X-derived items (mindshare, twitter, " +
            "ai_twitter, items with tweet payloads or X/Twitter " +
            "source URLs) are filtered out and never returned. " +
            "Lookup: by UUID (id) or name (q). Filter by lang " +
            "(en/zh/ja/kr). Returns 404 if not found.",
        docsUrl: "https://docs.asksurf.ai/data-api/project/ai-news",
        categories: ["company-news"],
        notes: [
            "Pass at least one of `id` or `q`; `id` takes priority " +
            "when several are given. A request with none is rejected " +
            "before the wire.",
        ],
    },
    request: { method: "GET", path: "/project/ai-news" },
    input: {
        schema: {
            // the identifier alternatives compile to anyOf (D4); a union arm
            // takes no binding default (ajv never applies defaults inside anyOf)
            queryParams: z.union([
                zProjectAiNewsQueryParams.required({ id: true }),
                zProjectAiNewsQueryParams.required({ q: true }),
            ]),
        },
    },
    usage: {
        // Surf's published Standard tier — v1 makePerCallPrice(surfCredits(2)),
        // the balance-differencing drills of 2026-08 (design D1)
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "call",
            consumes: { credit: "default", amount: 2 },
        },
    },
});
