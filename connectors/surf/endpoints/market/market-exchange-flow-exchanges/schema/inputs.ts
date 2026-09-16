import { z } from "zod";

/** GET /market/exchange-flow/exchanges query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zMarketExchangeFlowExchangesQueryParams = z.object({
    symbol: z.enum(["BTC", "ETH"]).describe(
        "Token ticker symbol. Can be BTC or ETH. Example: BTC.",
    ),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Example: 100. Defaults to 100.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
}).strict();
