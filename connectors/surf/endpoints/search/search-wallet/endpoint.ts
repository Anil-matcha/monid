import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zSearchWalletQueryParams } from "./schema/inputs.ts";

/**
 * GET /search/wallet — Heavy tier, 4 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Wallet Search",
        summary:
            "Searches wallets by ENS name, address label, or address prefix.",
        description:
            "Searches wallets by ENS name, address label, or address " +
            "prefix. Returns matching wallet addresses with entity " +
            "labels.",
        docsUrl: "https://docs.asksurf.ai/data-api/search/wallet",
        categories: ["onchain-data"],
    },
    request: { method: "GET", path: "/search/wallet" },
    input: {
        schema: {
            // vendor defaults at the binding (D25); the mirror stays optional-only
            queryParams: zSearchWalletQueryParams.extend({
                limit: zSearchWalletQueryParams.shape.limit.unwrap().default(
                    20,
                ),
                offset: zSearchWalletQueryParams.shape.offset.unwrap().default(
                    0,
                ),
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
