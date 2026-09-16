import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zTokenHoldersQueryParams } from "./schema/inputs.ts";

/**
 * GET /token/holders — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Token Holders",
        summary: "Returns top token holders for a contract address.",
        description: "Returns top token holders for a contract address. " +
            "Included fields: wallet address, balance, and " +
            "percentage. Lookup: by address and chain. Supports EVM " +
            "chains and Solana.",
        docsUrl: "https://docs.asksurf.ai/data-api/token/holders",
        categories: ["onchain-data"],
    },
    request: { method: "GET", path: "/token/holders" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zTokenHoldersQueryParams.extend({
                limit: zTokenHoldersQueryParams.shape.limit.unwrap().default(
                    20,
                ),
                offset: zTokenHoldersQueryParams.shape.offset.unwrap().default(
                    0,
                ),
            }),
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
