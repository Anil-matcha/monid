import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zSearchAirdropQueryParams } from "./schema/inputs.ts";

/**
 * GET /search/airdrop — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Airdrop Search",
        summary: "Searches and filters airdrop opportunities.",
        description: "Searches and filters airdrop opportunities. Filters: " +
            "keyword, status, reward type, task type. Returns " +
            "paginated results with optional task details.",
        docsUrl: "https://docs.asksurf.ai/data-api/search/airdrop",
        categories: ["onchain-data"],
    },
    request: { method: "GET", path: "/search/airdrop" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zSearchAirdropQueryParams.extend({
                phase: zSearchAirdropQueryParams.shape.phase.unwrap().default(
                    "active,claimable",
                ),
                has_open: zSearchAirdropQueryParams.shape.has_open.unwrap()
                    .default(false),
                sort_by: zSearchAirdropQueryParams.shape.sort_by.unwrap()
                    .default("last_status_update"),
                order: zSearchAirdropQueryParams.shape.order.unwrap().default(
                    "desc",
                ),
                limit: zSearchAirdropQueryParams.shape.limit.unwrap().default(
                    20,
                ),
                offset: zSearchAirdropQueryParams.shape.offset.unwrap().default(
                    0,
                ),
                include_tasks: zSearchAirdropQueryParams.shape.include_tasks
                    .unwrap().default(false),
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
