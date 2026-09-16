import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zOnchainQueryBody } from "./schema/inputs.ts";

/**
 * POST /onchain/query — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Blockchain Structured Query",
        summary:
            "Query on-chain tables with structured JSON filters — no SQL text.",
        description:
            "Query on-chain tables with structured JSON filters — no " +
            "SQL text. Pick a source table (discover with " +
            "/onchain/schema), then filter " +
            "(eq/gt/gte/lt/lte/like/in), sort, and limit (max 10000 " +
            "rows, 30s timeout). ALWAYS filter on block_date for " +
            "large tables. Never filter by symbol — resolve tickers " +
            "to contract addresses with /search/token and filter " +
            "contract_address instead. On transfer tables amount is " +
            "decimal-adjusted; amount_raw is base units. Timestamps " +
            "in results are Unix seconds, even for Date columns. For " +
            "joins or aggregations write SQL via /onchain/sql. " +
            "Refresh: ~24h.",
        docsUrl: "https://docs.asksurf.ai/data-api/onchain/query",
        categories: ["onchain-data"],
    },
    request: { method: "POST", path: "/onchain/query" },
    input: {
        schema: {
            body: zOnchainQueryBody,
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
