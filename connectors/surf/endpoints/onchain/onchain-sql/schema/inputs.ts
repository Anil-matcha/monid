import { z } from "zod";

/** POST /onchain/sql body (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zOnchainSqlBody = z.object({
    sql: z.string().min(1).describe(
        "Read-only ClickHouse SELECT/WITH query. Discover tables " +
            "with /onchain/schema. Rules (server-enforced or " +
            "query-killing): SELECT/WITH only (read-only); table " +
            "references must be database-qualified as agent.<table>; " +
            "ALWAYS filter on block_date or block_number (partition key " +
            "— without it the query times out); compare address columns " +
            "directly against lowercase literals (wrapping the column in " +
            "lower() is rejected); never filter on symbol columns " +
            "(unindexed full scan, and symbol matches surface scam " +
            "clones — resolve a ticker to a contract address with " +
            "/search/token first); on transfer tables use separate UNION " +
            "ALL branches instead of OR across from/to; use single " +
            "quotes for strings, e.g. toDate('2026-04-07'). Example: " +
            "SELECT block_date, sum(amount_usd) FROM " +
            "agent.ethereum_dex_trades WHERE block_date >= today() - 7 " +
            "GROUP BY block_date.",
    ),
    max_rows: z.number().int().min(1).max(10000).describe(
        "Maximum rows to return. Example: 100. Defaults to 1000 " +
            "(server-side), capped at 10000.",
    ).optional(),
}).strict();
