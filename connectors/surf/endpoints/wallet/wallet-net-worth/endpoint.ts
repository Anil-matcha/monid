import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zWalletNetWorthQueryParams } from "./schema/inputs.ts";

/**
 * GET /wallet/net-worth — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Wallet Net Worth History",
        summary:
            "Returns a time-series of the wallet's total net worth in USD.",
        description: "Returns a time-series of the wallet's total net worth " +
            "in USD. Returns ~288 data points at 5-minute intervals " +
            "covering the last 24 hours. Fixed window — no custom " +
            "time range supported. Lookup: by address (EVM only — " +
            "0x-prefixed hex). Solana addresses are not supported.",
        docsUrl: "https://docs.asksurf.ai/data-api/wallet/net-worth",
        categories: ["onchain-data"],
    },
    request: { method: "GET", path: "/wallet/net-worth" },
    input: {
        schema: {
            queryParams: zWalletNetWorthQueryParams,
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
