import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zMarketExchangeFlowExchangesQueryParams } from "./schema/inputs.ts";

/**
 * GET /market/exchange-flow/exchanges — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Exchange Flow Exchanges",
        summary: "Returns Surf's curated exchange filters for " +
            "exchange-flow metrics: upstream aggregate filters plus " +
            "20 high-coverage individual exchanges.",
        description: "Returns Surf's curated exchange filters for " +
            "exchange-flow metrics: upstream aggregate filters plus " +
            "20 high-coverage individual exchanges. Use the returned " +
            "symbol values as the exchange query parameter on " +
            "/v1/market/onchain-indicator when metric is one of " +
            "exchange-flows/inflow, exchange-flows/outflow, " +
            "exchange-flows/netflow, or exchange-flows/reserve. The " +
            "curated list intentionally excludes long-tail upstream " +
            "exchange entities that return empty data or bad-request " +
            "errors for flow metrics.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/market/exchange-flow-exchanges",
        categories: ["token-prices"],
    },
    request: { method: "GET", path: "/market/exchange-flow/exchanges" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zMarketExchangeFlowExchangesQueryParams.extend({
                limit: zMarketExchangeFlowExchangesQueryParams.shape.limit
                    .unwrap().default(100),
                offset: zMarketExchangeFlowExchangesQueryParams.shape.offset
                    .unwrap().default(0),
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
