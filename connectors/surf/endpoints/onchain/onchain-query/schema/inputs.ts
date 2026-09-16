import { z } from "zod";

/** One `filters` entry of POST /onchain/query. */
export const zStructuredFilter = z.object({
    field: z.string().min(1).describe(
        "Column name to filter on. Example: block_date. Never filter " +
            "on symbol columns (unindexed; resolve tickers to contract " +
            "addresses with /search/token first).",
    ),
    op: z.enum([
        "eq",
        "neq",
        "gt",
        "gte",
        "lt",
        "lte",
        "like",
        "in",
        "not_in",
    ]).describe(
        "Comparison operator. For in/not_in, value must be a JSON " +
            "array. Example: gte.",
    ),
    value: z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.array(z.union([z.string(), z.number()])),
    ]).describe(
        "Comparison value; a JSON array for in/not_in. Example: 2026-07-01.",
    ),
}).strict();

/** One `sort` entry of POST /onchain/query. */
export const zStructuredSort = z.object({
    field: z.string().min(1).describe(
        "Column name to sort by. Example: amount_usd.",
    ),
    order: z.enum(["asc", "desc"]).describe(
        'Sort direction. Example: desc. Defaults to "asc".',
    ).optional(),
}).strict();

/** POST /onchain/query body (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zOnchainQueryBody = z.object({
    source: z.string().regex(/^agent\.[a-z0-9_]+$/).describe(
        "Fully-qualified table name. Discover tables with " +
            "/onchain/schema. Example: agent.ethereum_dex_trades.",
    ),
    fields: z.array(z.string().min(1)).describe(
        "Columns to return. Omit to return all columns. Example: " +
            '["block_time", "amount_usd"].',
    ).optional(),
    filters: z.array(zStructuredFilter).describe(
        "WHERE conditions, ANDed together. ALWAYS include a " +
            "block_date bound on large tables — without it the query " +
            'times out. Example: [{"field": "block_date", "op": "gte", ' +
            '"value": "2026-07-01"}].',
    ).optional(),
    sort: z.array(zStructuredSort).describe(
        'ORDER BY clauses. Example: [{"field": "amount_usd", ' +
            '"order": "desc"}].',
    ).optional(),
    limit: z.number().int().min(1).max(10000).describe(
        "Max rows to return. Example: 20. Defaults to 20 " +
            "(server-side), capped at 10000.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Rows to skip for pagination. Example: 0. Defaults to 0.",
    ).optional(),
}).strict();
