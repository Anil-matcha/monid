import { defineEndpoint, UsageModelKind } from "@shared/core";
import {
    zPredictionMarketPolymarketPriceOhlcvPathParams,
    zPredictionMarketPolymarketPriceOhlcvQueryParams,
} from "./schema/inputs.ts";

/**
 * GET /prediction-market/polymarket/price-ohlcv/{condition_id} — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Polymarket OHLCV Candlesticks",
        summary: "OHLCV candlestick data for charting a Polymarket market " +
            "— open, high, low, close, volume per candle.",
        description:
            "OHLCV candlestick data for charting a Polymarket market " +
            "— open, high, low, close, volume per candle. Use this " +
            "for rendering price charts with candlestick or bar " +
            "visualizations. For simple price time series (one price " +
            "per interval), use prices instead. Data refresh: ~30 " +
            "minutes.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/prediction-market/polymarket-ohlcv",
        categories: ["prediction-markets"],
    },
    /** PUBLIC identity pinned brace-free (the id regex admits no
     *  placeholders); the wire path keeps `{condition_id}` (design D9). */
    endpoint: "/prediction-market/polymarket/price-ohlcv",
    request: {
        method: "GET",
        path: "/prediction-market/polymarket/price-ohlcv/{condition_id}",
    },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            pathParams: zPredictionMarketPolymarketPriceOhlcvPathParams,
            queryParams: zPredictionMarketPolymarketPriceOhlcvQueryParams
                .extend({
                    interval: zPredictionMarketPolymarketPriceOhlcvQueryParams
                        .shape.interval.unwrap().default(60),
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
