import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zOnchainTxQueryParams } from "./schema/inputs.ts";

/**
 * GET /onchain/tx — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Transaction Details by Hash",
        summary: "Look up one transaction by hash.",
        description: "Look up one transaction by hash. Example: " +
            "chain=ethereum with a 0x-prefixed 64-character hash. " +
            "All numeric fields are hex-encoded. Convert them with " +
            "parseInt(hex, 16). Supported chains: ethereum, polygon, " +
            "bsc, arbitrum, optimism, base, avalanche, fantom, " +
            "linea, cyber.",
        docsUrl: "https://docs.asksurf.ai/data-api/onchain/tx",
        categories: ["onchain-data"],
    },
    request: { method: "GET", path: "/onchain/tx" },
    input: {
        schema: {
            queryParams: zOnchainTxQueryParams,
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
