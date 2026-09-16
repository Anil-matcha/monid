import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zOnchainGasPriceQueryParams } from "./schema/inputs.ts";

/**
 * GET /onchain/gas-price — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Current Gas Price",
        summary: "Look up the current gas price for one EVM chain.",
        description: "Look up the current gas price for one EVM chain. " +
            "Example: chain=ethereum. This endpoint uses " +
            "eth_gasPrice JSON-RPC and returns gas price in both wei " +
            "and Gwei. Supported chains: ethereum, polygon, bsc, " +
            "arbitrum, optimism, base, avalanche, fantom, linea, " +
            "cyber.",
        docsUrl: "https://docs.asksurf.ai/data-api/onchain/gas-price",
        categories: ["onchain-data"],
    },
    request: { method: "GET", path: "/onchain/gas-price" },
    input: {
        schema: {
            queryParams: zOnchainGasPriceQueryParams,
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
