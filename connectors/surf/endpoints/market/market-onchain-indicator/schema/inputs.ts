import { z } from "zod";

/** GET /market/onchain-indicator query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zMarketOnchainIndicatorQueryParams = z.object({
    symbol: z.enum(["BTC", "ETH"]).describe(
        "Token ticker symbol. Can be BTC or ETH. Example: BTC.",
    ),
    metric: z.enum([
        "nupl",
        "sopr",
        "mvrv",
        "puell-multiple",
        "nvm",
        "nvt",
        "nvt-golden-cross",
        "exchange-flows/inflow",
        "exchange-flows/outflow",
        "exchange-flows/netflow",
        "exchange-flows/reserve",
    ]).describe(
        "On-chain metric name. Can be nupl, sopr, mvrv, " +
            "puell-multiple, nvm, nvt, nvt-golden-cross, or " +
            "exchange-flows/{inflow,outflow,netflow,reserve}. Example: " +
            "nupl.",
    ),
    granularity: z.enum(["day"]).describe(
        'Aggregation granularity. Example: day. Defaults to "day".',
    ).optional(),
    from: z.string().min(1).describe(
        "Start of time range. Accepts Unix seconds or date string " +
            "(YYYY-MM-DD). Defaults to 90 days ago when omitted. Maximum " +
            "range is 365 days. Responses are capped at about 100 data " +
            "points; when meta.has_more is true, split from/to into " +
            "smaller windows (about 90 days for daily data). Example: " +
            "2026-01-01.",
    ).optional(),
    to: z.string().min(1).describe(
        "End of time range. Accepts Unix seconds or date string " +
            "(YYYY-MM-DD). Defaults to today when omitted. Maximum range " +
            "is 365 days. Responses are capped at about 100 data points; " +
            "when meta.has_more is true, split from/to into smaller " +
            "windows (about 90 days for daily data). Example: " +
            "2026-03-01.",
    ).optional(),
    exchange: z.enum([
        "all_exchange",
        "spot_exchange",
        "derivative_exchange",
        "coinbase_prime",
        "binance",
        "coinbase_advanced",
        "okx",
        "kraken",
        "bybit",
        "bitstamp",
        "gemini",
        "bitget",
        "kucoin",
        "bitfinex",
        "gate_io",
        "deribit",
        "mexc",
        "htx_global",
        "bitflyer",
        "coinone",
        "bithumb",
        "upbit",
        "hashkey_exchange",
    ]).describe(
        "Curated exchange filter for exchange-flow metrics. Use " +
            "/v1/market/exchange-flow/exchanges to list labels. Example: " +
            'all_exchange. Defaults to "all_exchange".',
    ).optional(),
}).strict();
