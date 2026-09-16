import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zWalletTransfersQueryParams } from "./schema/inputs.ts";

/**
 * GET /wallet/transfers — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Wallet Transfer History",
        summary: "Returns ERC-20/SPL token transfers with token identity, " +
            "USD value, and flow direction (in/out).",
        description:
            "Returns ERC-20/SPL token transfers with token identity, " +
            "USD value, and flow direction (in/out). Unlike " +
            "wallet-history which shows all tx types in native " +
            "value, this focuses on token-level transfer activity. " +
            "Pass the wallet address in address — returns all " +
            "ERC-20/SPL token transfers where this wallet is the " +
            "sender or receiver. Included fields: token contract, " +
            "token symbol, amount USD, counterparty, flow direction. " +
            "Filter by specific token or flow direction (in/out). " +
            "Lookup: address (wallet, raw 0x hex or base58 — ENS not " +
            "supported). Filter by chain — supports ethereum, base, " +
            "bsc, arbitrum, tron, solana. Data refresh: ~24 hours · " +
            "Chains: Ethereum, Base, BSC, Arbitrum, Tron (Solana " +
            "uses a different source with no delay).",
        docsUrl: "https://docs.asksurf.ai/data-api/wallet/transfers",
        categories: ["onchain-data"],
    },
    request: { method: "GET", path: "/wallet/transfers" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zWalletTransfersQueryParams.extend({
                chain: zWalletTransfersQueryParams.shape.chain.unwrap().default(
                    "ethereum",
                ),
                limit: zWalletTransfersQueryParams.shape.limit.unwrap().default(
                    20,
                ),
                offset: zWalletTransfersQueryParams.shape.offset.unwrap()
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
