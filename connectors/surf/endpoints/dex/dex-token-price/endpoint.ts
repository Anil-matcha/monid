import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zDexTokenPriceQueryParams } from "./schema/inputs.ts";

/**
 * GET /dex/token/price — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "DEX Token OHLCV Price",
        summary: "Returns DEX-pool-weighted OHLCV bars (timestamp, open, " +
            "high, low, close, volume_usd) for a single token " +
            "identified by chain + address.",
        description: "Returns DEX-pool-weighted OHLCV bars (timestamp, open, " +
            "high, low, close, volume_usd) for a single token " +
            "identified by chain + address. USD only. Bars are " +
            "sorted ascending by timestamp. Use for meme coins, " +
            "newly-launched tokens, and any DEX-native asset where " +
            "/v1/market/price returns nothing. Prefer the standard " +
            "/v1/market/price for major listed tokens (BTC, ETH, " +
            "etc.). Time window: time_range (default 24h) sets the " +
            "window; from+to (Unix seconds or YYYY-MM-DD) override " +
            "it. Bars use closed-interval semantics, so 24h × 1h " +
            "returns 25 bars. Maximum 1500 bars per call — " +
            "combinations exceeding the cap (e.g. 30d × 5m) return " +
            "422. time_range=max returns the largest allowed " +
            "1500-bar window for the selected interval. Identity: " +
            "chain (enum) + address (EVM hex or Solana base58). No " +
            "symbol input.",
        docsUrl: "https://docs.asksurf.ai/data-api/dex/token-price",
        categories: ["token-prices"],
    },
    request: { method: "GET", path: "/dex/token/price" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zDexTokenPriceQueryParams.extend({
                interval: zDexTokenPriceQueryParams.shape.interval.unwrap()
                    .default("1h"),
                time_range: zDexTokenPriceQueryParams.shape.time_range.unwrap()
                    .default("24h"),
            }),
        },
    },
    usage: {
        // Surf's published Light tier — v1 makePerCallPrice(surfCredits(1)),
        // the balance-differencing drills of 2026-08 (design D1)
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "call",
            consumes: { credit: "default", amount: 1 },
        },
    },
});
