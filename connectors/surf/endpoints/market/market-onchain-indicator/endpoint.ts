import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zMarketOnchainIndicatorQueryParams } from "./schema/inputs.ts";

/**
 * GET /market/onchain-indicator — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "On-Chain Indicator",
        summary: "Returns on-chain indicator time-series for BTC or ETH.",
        description: "Returns on-chain indicator time-series for BTC or ETH. " +
            "Available metrics: nupl, sopr, mvrv, puell-multiple, " +
            "nvm, nvt, nvt-golden-cross, exchange-flows " +
            "(inflow/outflow/netflow/reserve). Long ranges: each " +
            "response is capped at about 100 data points. When " +
            "meta.has_more=true, split from/to into smaller windows " +
            "(about 90 days for daily data) and merge by timestamp " +
            "client-side. For exchange-flow metrics, all_exchange, " +
            "spot_exchange, and derivative_exchange are aggregate " +
            "filters, not sums over the curated individual exchange " +
            "list.",
        docsUrl: "https://docs.asksurf.ai/data-api/market/onchain-indicator",
        categories: ["crypto-signals"],
    },
    request: { method: "GET", path: "/market/onchain-indicator" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zMarketOnchainIndicatorQueryParams.extend({
                granularity: zMarketOnchainIndicatorQueryParams.shape
                    .granularity.unwrap().default("day"),
                exchange: zMarketOnchainIndicatorQueryParams.shape.exchange
                    .unwrap().default("all_exchange"),
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
