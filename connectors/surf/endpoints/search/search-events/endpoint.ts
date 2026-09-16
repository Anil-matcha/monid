import { z } from "zod";
import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zSearchEventsQueryParams } from "./schema/inputs.ts";

/**
 * GET /search/events — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Project Event Search",
        summary:
            "Searches project events by keyword, optionally filtered by type.",
        description:
            "Searches project events by keyword, optionally filtered " +
            "by type. Valid types: launch, upgrade, partnership, " +
            "news, airdrop, listing, twitter. Lookup: by UUID (id) " +
            "or name (q). Returns 404 if the project is not found.",
        docsUrl: "https://docs.asksurf.ai/data-api/search/events",
        categories: ["company-enrichment"],
        notes: [
            "Pass at least one of `id` or `q`; `id` takes priority " +
            "when several are given. A request with none is rejected " +
            "before the wire.",
        ],
    },
    request: { method: "GET", path: "/search/events" },
    input: {
        schema: {
            // the identifier alternatives compile to anyOf (D4); a union arm
            // takes no binding default (ajv never applies defaults inside anyOf)
            queryParams: z.union([
                zSearchEventsQueryParams.required({ id: true }),
                zSearchEventsQueryParams.required({ q: true }),
            ]),
        },
    },
    usage: {
        // Surf's published Light tier — v1 makePerCallPrice(surfCredits(1)),
        // the balance-differencing drills of 2026-08 (design D1)
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "call",
            consumes: { credit: "default", amount: 1 },
        },
    },
});
