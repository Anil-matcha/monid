import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zMarketEtfQueryParams } from "./schema/inputs.ts";

/**
 * GET /market/etf — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "ETF Flow History",
        summary: "Returns daily spot ETF flow history.",
        description: "Returns daily spot ETF flow history. Included fields: " +
            "net flow (USD), token price, per-ticker breakdown. " +
            "Sorted by date descending. symbol: BTC, ETH, XRP, SOL, " +
            "or HYPE.",
        docsUrl: "https://docs.asksurf.ai/data-api/market/etf",
        categories: ["token-prices"],
    },
    request: { method: "GET", path: "/market/etf" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zMarketEtfQueryParams.extend({
                sort_by: zMarketEtfQueryParams.shape.sort_by.unwrap().default(
                    "timestamp",
                ),
                order: zMarketEtfQueryParams.shape.order.unwrap().default(
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
