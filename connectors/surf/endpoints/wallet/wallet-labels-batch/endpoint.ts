import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zWalletLabelsBatchQueryParams } from "./schema/inputs.ts";

/**
 * GET /wallet/labels/batch — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Wallet Labels (Batch)",
        summary: "Returns entity labels for multiple wallet addresses.",
        description: "Returns entity labels for multiple wallet addresses. " +
            "Pass up to 100 comma-separated addresses via the " +
            "addresses query parameter. Included fields: entity " +
            "name, type, and labels per address.",
        docsUrl: "https://docs.asksurf.ai/data-api/wallet/labels-batch",
        categories: ["onchain-data"],
    },
    request: { method: "GET", path: "/wallet/labels/batch" },
    input: {
        schema: {
            queryParams: zWalletLabelsBatchQueryParams,
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
