import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zOnchainSqlBody } from "./schema/inputs.ts";

/**
 * POST /onchain/sql — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Blockchain SQL Query",
        summary: "Run a read-only ClickHouse SQL query against on-chain " +
            "data (joins, aggregations, custom windows) with a 30s " +
            "timeout.",
        description: "Run a read-only ClickHouse SQL query against on-chain " +
            "data — joins, aggregations, and custom windows the " +
            "fixed endpoints cannot express. 111 tables in the agent " +
            "database (discover with /onchain/schema), max 10000 " +
            "rows, 30s timeout. Rules (server-enforced or " +
            "query-killing): SELECT/WITH only (read-only); table " +
            "references must be database-qualified as agent.<table>; " +
            "ALWAYS filter on block_date or block_number (partition " +
            "key — without it the query times out); compare address " +
            "columns directly against lowercase literals (wrapping " +
            "the column in lower() is rejected); never filter on " +
            "symbol columns (unindexed full scan, and symbol matches " +
            "surface scam clones — resolve a ticker to a contract " +
            "address with /search/token first); on transfer tables " +
            "use separate UNION ALL branches instead of OR across " +
            "from/to; use single quotes for strings, e.g. " +
            "toDate('2026-04-07'). Timestamps in results are Unix " +
            "seconds, even for Date columns. A timeout answers 408 " +
            "with recommended_action use_async_job — submit the same " +
            "SQL to /onchain/sql/jobs instead of retrying here. " +
            "Estimate cost/validity first with " +
            "/onchain/sql/preflight. Refresh: ~24h.",
        docsUrl: "https://docs.asksurf.ai/data-api/onchain/sql",
        categories: ["onchain-data"],
    },
    request: { method: "POST", path: "/onchain/sql" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            body: zOnchainSqlBody.extend({
                max_rows: zOnchainSqlBody.shape.max_rows.unwrap().default(1000),
            }),
        },
    },
    // the 30 s upstream execution window plus headroom (v1 def override)
    timeouts: { requestMs: 45_000, runMs: 45_000 },
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
