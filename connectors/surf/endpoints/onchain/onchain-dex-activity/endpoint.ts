import { z } from "zod";
import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zOnchainDexActivityQueryParams } from "./schema/inputs.ts";

/**
 * GET /onchain/dex/activity — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "DEX Protocol Activity",
        summary: "Active traders, trade count, and USD volume for a DEX " +
            "protocol (or a specific router contract), as a single " +
            "aggregate or a daily series (group_by=day).",
        description: "Active traders, trade count, and USD volume for a DEX " +
            "protocol (or a specific router contract), as a single " +
            "aggregate or a daily series (group_by=day). Lookup: " +
            "chain + exactly one of project (e.g. uniswap, " +
            "pancakeswap) or address (a router measured as tx_to). " +
            "Related: per-swap rows for a single token → " +
            "/v1/token/dex-trades. Chains: Ethereum, Base, BSC, " +
            "Arbitrum, Tron · Refresh: ~24h · USD volume lags ~3 " +
            "days (see enriched_ratio).",
        docsUrl: "https://docs.asksurf.ai/data-api/onchain/dex-activity",
        categories: ["defi"],
        notes: [
            "Pass exactly one of `project` or `address`; the request " +
            "is rejected before the wire when neither is given, and " +
            "upstream rejects both together.",
        ],
    },
    request: { method: "GET", path: "/onchain/dex/activity" },
    input: {
        schema: {
            // the identifier alternatives compile to anyOf (D4); a union arm
            // takes no binding default (ajv never applies defaults inside anyOf)
            queryParams: z.union([
                zOnchainDexActivityQueryParams.required({ project: true }),
                zOnchainDexActivityQueryParams.required({ address: true }),
            ]),
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
