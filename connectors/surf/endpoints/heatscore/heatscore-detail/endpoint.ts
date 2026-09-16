import { z } from "zod";
import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zHeatscoreDetailQueryParams } from "./schema/inputs.ts";

/**
 * GET /heatscore/detail — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Signal Detail",
        summary: "Returns one project signal card.",
        description: "Returns one project signal card. Lookup: pass exactly " +
            "one of id (Surf token UUID) or project_slug. Use " +
            "time_range (24h or 7d) to select the score window.",
        docsUrl: "https://docs.asksurf.ai/data-api/signal/detail",
        categories: ["crypto-signals"],
        notes: [
            "Pass exactly one of `id` or `project_slug`; the request " +
            "is rejected before the wire when neither is given, and " +
            "upstream rejects both together.",
        ],
    },
    request: { method: "GET", path: "/heatscore/detail" },
    input: {
        schema: {
            // the identifier alternatives compile to anyOf (D4); a union arm
            // takes no binding default (ajv never applies defaults inside anyOf)
            queryParams: z.union([
                zHeatscoreDetailQueryParams.required({ id: true }),
                zHeatscoreDetailQueryParams.required({ project_slug: true }),
            ]),
        },
    },
    usage: {
        // Surf's published Heavy tier — v1 makePerCallPrice(surfCredits(4)),
        // the balance-differencing drills of 2026-08 (design D1)
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "call",
            consumes: { credit: "default", amount: 4 },
        },
    },
});
