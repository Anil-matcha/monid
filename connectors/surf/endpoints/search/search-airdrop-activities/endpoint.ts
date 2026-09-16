import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zSearchAirdropActivitiesQueryParams } from "./schema/inputs.ts";

/**
 * GET /search/airdrop/activities — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Airdrop Activities",
        summary: "Lists airdrop activities with pagination.",
        description: "Lists airdrop activities with pagination. Returns " +
            "activity metadata including reward type, status, and " +
            "social metrics.",
        docsUrl: "https://docs.asksurf.ai/data-api/search/airdrop-activities",
        categories: ["onchain-data"],
    },
    request: { method: "GET", path: "/search/airdrop/activities" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zSearchAirdropActivitiesQueryParams.extend({
                limit: zSearchAirdropActivitiesQueryParams.shape.limit.unwrap()
                    .default(20),
                offset: zSearchAirdropActivitiesQueryParams.shape.offset
                    .unwrap().default(0),
            }),
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
