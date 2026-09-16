import { z } from "zod";
import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zMarketTgeQueryParams } from "./schema/inputs.ts";

/**
 * GET /market/tge — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Token Generation Event",
        summary: "Returns Token Generation Event (TGE) status for a project.",
        description: "Returns Token Generation Event (TGE) status for a " +
            "project. Includes current status, last event time, and " +
            "listing exchanges.",
        docsUrl: "https://docs.asksurf.ai/data-api/market/tge",
        categories: ["token-prices"],
        notes: [
            "Pass at least one of `id` or `q`; `id` takes priority " +
            "when several are given. A request with none is rejected " +
            "before the wire.",
        ],
    },
    request: { method: "GET", path: "/market/tge" },
    input: {
        schema: {
            // the identifier alternatives compile to anyOf (D4); a union arm
            // takes no binding default (ajv never applies defaults inside anyOf)
            queryParams: z.union([
                zMarketTgeQueryParams.required({ id: true }),
                zMarketTgeQueryParams.required({ q: true }),
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
