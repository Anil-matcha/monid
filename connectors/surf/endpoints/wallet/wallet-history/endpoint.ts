import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zWalletHistoryQueryParams } from "./schema/inputs.ts";

/**
 * GET /wallet/history — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Wallet Transaction History",
        summary: "Returns all on-chain transactions for a wallet, " +
            "classified by type (send, receive, swap, approve) with " +
            "native token value.",
        description: "Returns all on-chain transactions for a wallet, " +
            "classified by type (send, receive, swap, approve) with " +
            "native token value. For ERC-20 token transfers with " +
            "token identity and USD value, use wallet-transfers " +
            "instead. Lookup: by address. Filter by chain — supports " +
            "ethereum, polygon, bsc, arbitrum, optimism, avalanche, " +
            "fantom, base.",
        docsUrl: "https://docs.asksurf.ai/data-api/wallet/history",
        categories: ["onchain-data"],
    },
    request: { method: "GET", path: "/wallet/history" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zWalletHistoryQueryParams.extend({
                chain: zWalletHistoryQueryParams.shape.chain.unwrap().default(
                    "ethereum",
                ),
                limit: zWalletHistoryQueryParams.shape.limit.unwrap().default(
                    20,
                ),
                offset: zWalletHistoryQueryParams.shape.offset.unwrap().default(
                    0,
                ),
                sort_by: zWalletHistoryQueryParams.shape.sort_by.unwrap()
                    .default("timestamp"),
                order: zWalletHistoryQueryParams.shape.order.unwrap().default(
                    "desc",
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
