import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zTokenTransfersQueryParams } from "./schema/inputs.ts";

/**
 * GET /token/transfers — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Token Transfer History",
        summary: "Returns recent transfer events for a specific token " +
            "(ERC-20/TRC-20 contract).",
        description: "Returns recent transfer events for a specific token " +
            "(ERC-20/TRC-20 contract). Pass the token contract " +
            "address in address — returns every on-chain transfer of " +
            "that token regardless of sender/receiver. Included " +
            "fields: sender, receiver, raw amount, block timestamp. " +
            "Use this to analyze a token's on-chain activity (e.g. " +
            "large movements, distribution patterns). Lookup: " +
            "address (token contract) + chain. Data refresh: ~24 " +
            "hours · Chains: Ethereum, Base, BSC, Arbitrum, Tron " +
            "(Solana uses a different source with no delay).",
        docsUrl: "https://docs.asksurf.ai/data-api/token/transfers",
        categories: ["onchain-data"],
    },
    request: { method: "GET", path: "/token/transfers" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zTokenTransfersQueryParams.extend({
                limit: zTokenTransfersQueryParams.shape.limit.unwrap().default(
                    20,
                ),
                offset: zTokenTransfersQueryParams.shape.offset.unwrap()
                    .default(0),
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
