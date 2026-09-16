import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zWalletProtocolsQueryParams } from "./schema/inputs.ts";

/**
 * GET /wallet/protocols — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Wallet DeFi Protocol Positions",
        summary: "Returns all DeFi protocol positions for a wallet — " +
            "lending, staking, LP, and farming with token breakdowns " +
            "and USD values.",
        description: "Returns all DeFi protocol positions for a wallet — " +
            "lending, staking, LP, and farming with token breakdowns " +
            "and USD values. Lookup: by address (EVM only — " +
            "0x-prefixed hex). Solana addresses are not supported.",
        docsUrl: "https://docs.asksurf.ai/data-api/wallet/protocols",
        categories: ["onchain-data"],
    },
    request: { method: "GET", path: "/wallet/protocols" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zWalletProtocolsQueryParams.extend({
                limit: zWalletProtocolsQueryParams.shape.limit.unwrap().default(
                    20,
                ),
                offset: zWalletProtocolsQueryParams.shape.offset.unwrap()
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
