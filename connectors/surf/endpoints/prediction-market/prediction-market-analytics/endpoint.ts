import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPredictionMarketAnalyticsQueryParams } from "./schema/inputs.ts";

/**
 * GET /prediction-market/analytics — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Prediction Market Analytics",
        summary: "Trends, top markets, momentum distribution, and " +
            "per-market momentum signals for prediction markets.",
        description: "Trends, top markets, momentum distribution, and " +
            "per-market momentum signals for prediction markets. " +
            "Platform-wide totals: Omit category to get aggregated " +
            "volume/OI/market-count across the entire prediction " +
            "market (Polymarket + Kalshi combined). Use platform to " +
            "filter to one exchange. This is the recommended way to " +
            "answer questions like \"What is Polymarket's total " +
            'volume this week?" or "How does Kalshi volume compare ' +
            'to Polymarket?" Category drill-down: Provide category ' +
            "to scope all data to one category (e.g. crypto, " +
            "politics). Combines volume/OI time series, top markets " +
            "by open interest, momentum summary (price/volume signal " +
            "distribution), and per-market momentum signals (price " +
            "changes, volume direction, whale flows). Note on " +
            "top_markets: When both category and platform are " +
            "omitted, top markets are ranked globally by open " +
            "interest. Because Polymarket OI is significantly larger " +
            "than Kalshi OI, the list will skew heavily toward " +
            "Polymarket. Use platform to get per-platform rankings. " +
            "Use search instead if you want to browse/search " +
            "individual markets. Data refresh: ~5 minutes.",
        docsUrl: "https://docs.asksurf.ai/data-api/prediction-market/analytics",
        categories: ["prediction-markets"],
    },
    request: { method: "GET", path: "/prediction-market/analytics" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zPredictionMarketAnalyticsQueryParams.extend({
                time_range: zPredictionMarketAnalyticsQueryParams.shape
                    .time_range.unwrap().default("30d"),
                top_n: zPredictionMarketAnalyticsQueryParams.shape.top_n
                    .unwrap().default(10),
                sort_by: zPredictionMarketAnalyticsQueryParams.shape.sort_by
                    .unwrap().default("volume_7d"),
                order: zPredictionMarketAnalyticsQueryParams.shape.order
                    .unwrap().default("desc"),
                limit: zPredictionMarketAnalyticsQueryParams.shape.limit
                    .unwrap().default(20),
                offset: zPredictionMarketAnalyticsQueryParams.shape.offset
                    .unwrap().default(0),
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
