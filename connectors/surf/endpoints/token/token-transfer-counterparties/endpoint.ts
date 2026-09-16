import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zTokenTransferCounterpartiesQueryParams } from "./schema/inputs.ts";

/**
 * GET /token/transfer-counterparties — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Top Transfer Counterparties",
        summary: "Ranked top counterparties (receivers or senders) of a " +
            'token over a window — answers "who are the top ' +
            'receivers/senders?".',
        description: "Ranked top counterparties (receivers or senders) of a " +
            'token over a window — answers "who are the top ' +
            'receivers/senders?". Lookup: address (token contract) + ' +
            "chain + direction (to = top receivers, from = top " +
            "senders). Rank by metric (count, amount, amount_usd). " +
            "Related: raw rows → /v1/token/transfers; aggregate " +
            "summary → /v1/token/transfer-stats. Chains: Ethereum, " +
            "Base, BSC, Arbitrum, Tron · Refresh: ~24h.",
        docsUrl:
            "https://docs.asksurf.ai/data-api/token/transfer-counterparties",
        categories: ["onchain-data"],
    },
    request: { method: "GET", path: "/token/transfer-counterparties" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zTokenTransferCounterpartiesQueryParams.extend({
                metric: zTokenTransferCounterpartiesQueryParams.shape.metric
                    .unwrap().default("count"),
                time_range: zTokenTransferCounterpartiesQueryParams.shape
                    .time_range.unwrap().default("7d"),
                limit: zTokenTransferCounterpartiesQueryParams.shape.limit
                    .unwrap().default(20),
                offset: zTokenTransferCounterpartiesQueryParams.shape.offset
                    .unwrap().default(0),
            }),
        },
    },
    usage: {
        // Surf's published Standard tier — v1 makePerCallPrice(surfCredits(2)),
        // the balance-differencing drills of 2026-08 (design D1)
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "call",
            consumes: { credit: "default", amount: 2 },
        },
    },
});
