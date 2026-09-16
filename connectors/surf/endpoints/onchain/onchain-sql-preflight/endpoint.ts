import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zOnchainSqlPreflightBody } from "./schema/inputs.ts";

/**
 * POST /onchain/sql/preflight — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Preflight Blockchain SQL Query",
        summary: "Validate and cost-estimate a ClickHouse SQL query " +
            "(EXPLAIN ESTIMATE) without executing it.",
        description: "Validate and cost-estimate a ClickHouse SQL query " +
            "without executing it (EXPLAIN ESTIMATE). Returns " +
            "accepted true/false, the server-bounded executed_sql, " +
            "estimated parts/rows/marks/bytes per table, the scan " +
            "budget, and machine-readable guardrail warnings " +
            "(missing partition filter, unprunable predicates) with " +
            "recommended actions. NOTE: costs the SAME as executing " +
            "the query — use it as insurance before an expensive or " +
            "uncertain /onchain/sql or /onchain/sql/jobs run, not as " +
            "a routine pre-check.",
        categories: ["onchain-data"],
    },
    request: { method: "POST", path: "/onchain/sql/preflight" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            body: zOnchainSqlPreflightBody.extend({
                max_rows: zOnchainSqlPreflightBody.shape.max_rows.unwrap()
                    .default(1000),
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
