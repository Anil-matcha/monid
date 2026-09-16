import { z } from "zod";

/** GET /onchain/schema query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zOnchainSchemaQueryParams = z.object({
    table: z.string().min(1).describe(
        "Optional logical table name from the agent database. When " +
            "set, the response adds bounded physical metadata: engine, " +
            "partition key, sorting key, primary key, row estimate, and " +
            "compressed bytes. Example: polymarket_trades.",
    ).optional(),
}).strict();
