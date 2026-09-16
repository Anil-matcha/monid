import { z } from "zod";
import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zProjectDetailQueryParams } from "./schema/inputs.ts";

/**
 * GET /project/detail — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Aggregated Project Detail",
        summary: "Returns a crypto project's profile with selectable " +
            "sub-resources: overview (description, chains, " +
            "exchanges), token_info (price, market cap, supply, " +
            "all-time high/low dates), tokenomics, funding, team, " +
            "contracts, social, tge_status.",
        description: "Returns a crypto project's profile with selectable " +
            "sub-resources: overview (description, chains, " +
            "exchanges), token_info (price, market cap, supply, " +
            "all-time high/low dates), tokenomics, funding, team, " +
            "contracts, social, tge_status. Available fields (via " +
            "fields): overview, token_info, tokenomics, funding, " +
            "team, contracts, social, tge_status. Important: " +
            "tokenomics is a legacy supply/valuation group " +
            "(total_supply, circulating_supply, market_cap_usd, " +
            "fdv). It does not include token unlock schedule, " +
            "allocation, or unlock percentage data. For unlock " +
            "schedule and unlocked-supply percentage, use " +
            "/token/tokenomics. Lookup: accepts project names " +
            "directly via q (e.g. ?q=aave) — no need to call " +
            "/search/project first. Also accepts UUID via id. " +
            "Returns 404 if not found. For DeFi metrics (TVL, fees, " +
            "revenue, volume, users) and per-chain breakdown, use " +
            "/project/defi/metrics.",
        docsUrl: "https://docs.asksurf.ai/data-api/project/detail",
        categories: ["company-enrichment"],
        notes: [
            "Pass at least one of `id`, `x_id`, `handle` or `q`; " +
            "`id` takes priority when several are given. A request " +
            "with none is rejected before the wire.",
        ],
    },
    request: { method: "GET", path: "/project/detail" },
    input: {
        schema: {
            // the identifier alternatives compile to anyOf (D4); a union arm
            // takes no binding default (ajv never applies defaults inside anyOf)
            queryParams: z.union([
                zProjectDetailQueryParams.required({ id: true }),
                zProjectDetailQueryParams.required({ x_id: true }),
                zProjectDetailQueryParams.required({ handle: true }),
                zProjectDetailQueryParams.required({ q: true }),
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
