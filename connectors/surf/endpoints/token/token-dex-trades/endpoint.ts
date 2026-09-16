import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zTokenDexTradesQueryParams } from "./schema/inputs.ts";

/**
 * GET /token/dex-trades — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Token DEX Trade History",
        summary: "Returns recent DEX swap events for a token contract address.",
        description: "Returns recent DEX swap events for a token contract " +
            "address. Covered DEXes: uniswap, sushiswap, curve, " +
            "balancer, pancakeswap (and other major DEXes per " +
            "chain). Included fields: trading pair, amounts, USD " +
            "value, taker address. Data refresh: ~24 hours · Chains: " +
            "Ethereum, Base, BSC, Arbitrum, Tron.",
        docsUrl: "https://docs.asksurf.ai/data-api/token/dex-trades",
        categories: ["onchain-data"],
    },
    request: { method: "GET", path: "/token/dex-trades" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zTokenDexTradesQueryParams.extend({
                chain: zTokenDexTradesQueryParams.shape.chain.unwrap().default(
                    "ethereum",
                ),
                limit: zTokenDexTradesQueryParams.shape.limit.unwrap().default(
                    20,
                ),
                offset: zTokenDexTradesQueryParams.shape.offset.unwrap()
                    .default(0),
            }),
        },
    },
    usage: {
        // Surf's published Heavy tier — v1 makePerCallPrice(surfCredits(4)),
        // the balance-differencing drills of 2026-08 (design D1)
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "call",
            consumes: { credit: "default", amount: 4 },
        },
    },
});
