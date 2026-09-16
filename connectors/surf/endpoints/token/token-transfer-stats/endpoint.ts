import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zTokenTransferStatsQueryParams } from "./schema/inputs.ts";

/**
 * GET /token/transfer-stats — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Token Transfer Activity Summary",
        summary: "Aggregate transfer-activity summary for a token over a " +
            "window — total transfers, unique senders/receivers, " +
            "total amount, first/last activity, and an optional " +
            "daily series (include=series).",
        description: "Aggregate transfer-activity summary for a token over a " +
            "window — total transfers, unique senders/receivers, " +
            "total amount, first/last activity, and an optional " +
            "daily series (include=series). Lookup: address (token " +
            "contract) + chain. Related: per-counterparty ranking → " +
            "/v1/token/transfer-counterparties; raw rows → " +
            "/v1/token/transfers. Chains: Ethereum, Base, BSC, " +
            "Arbitrum, Tron · Refresh: ~24h · USD value lags ~3 days " +
            "(see enriched_ratio).",
        docsUrl: "https://docs.asksurf.ai/data-api/token/transfer-stats",
        categories: ["onchain-data"],
    },
    request: { method: "GET", path: "/token/transfer-stats" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zTokenTransferStatsQueryParams.extend({
                time_range: zTokenTransferStatsQueryParams.shape.time_range
                    .unwrap().default("7d"),
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
