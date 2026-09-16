import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zWalletDetailQueryParams } from "./schema/inputs.ts";

/**
 * GET /wallet/detail — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Aggregated Wallet Detail",
        summary: "Returns a wallet's cross-chain portfolio with " +
            "selectable sub-resources (balance, tokens, labels, " +
            "NFTs).",
        description: "Returns a wallet's cross-chain portfolio with " +
            "selectable sub-resources (balance, tokens, labels, " +
            "NFTs). Always includes per-chain USD breakdown across " +
            "15+ EVM chains. Available fields (via fields): balance, " +
            "tokens, labels, nft. Lookup: by address. Partial " +
            "failures return available fields with per-field error " +
            "info. Returns 422 if fields is invalid.",
        docsUrl: "https://docs.asksurf.ai/data-api/wallet/detail",
        categories: ["onchain-data"],
    },
    request: { method: "GET", path: "/wallet/detail" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zWalletDetailQueryParams.extend({
                fields: zWalletDetailQueryParams.shape.fields.unwrap().default(
                    "balance,tokens,labels,nft",
                ),
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
