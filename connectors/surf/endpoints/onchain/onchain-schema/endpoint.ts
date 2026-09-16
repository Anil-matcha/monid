import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zOnchainSchemaQueryParams } from "./schema/inputs.ts";

/**
 * GET /onchain/schema — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "On-Chain Table Schema",
        summary: "List the on-chain SQL tables and their columns — call " +
            "this before writing a query for /onchain/query or " +
            "/onchain/sql.",
        description: "List the on-chain SQL tables and their columns — call " +
            "this before writing a query for /onchain/query or " +
            "/onchain/sql. 111 tables in the agent database: " +
            "per-chain dex_trades, transfers, prices, TVL and fees " +
            "(Ethereum, Base, Arbitrum, BSC, Tron, HyperEVM, Tempo, " +
            "Robinhood), Polymarket and Kalshi trades and markets, " +
            "Hyperliquid perps, whale and bridge aggregates. Pass " +
            "table=<name> for one table's physical metadata " +
            "(partition key, row count, bytes). Note: this call " +
            "costs the same as running a query — cache the result " +
            "rather than re-fetching per query. Refresh: ~24h.",
        docsUrl: "https://docs.asksurf.ai/data-api/onchain/schema",
        categories: ["onchain-data"],
    },
    request: { method: "GET", path: "/onchain/schema" },
    input: {
        schema: {
            queryParams: zOnchainSchemaQueryParams,
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
