import { z } from "zod";
import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zTokenTokenomicsQueryParams } from "./schema/inputs.ts";

/**
 * GET /token/tokenomics — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Token Unlock Schedule",
        summary: "Returns token unlock time-series with cumulative " +
            "amounts, allocation breakdowns, total supply " +
            "denominator, and unlocked-supply percentage.",
        description: "Returns token unlock time-series with cumulative " +
            "amounts, allocation breakdowns, total supply " +
            "denominator, and unlocked-supply percentage. Lookup: by " +
            "project UUID (id) or token symbol. Filter by date range " +
            "with from/to — defaults to the current calendar month " +
            "when omitted. Important: unlock_amount is a legacy " +
            "alias for cumulative_unlocked_amount; it is already " +
            "cumulative at each timestamp and must not be summed " +
            "across rows. Use unlocked_percentage_of_total_supply " +
            "for the unlock ratio. Returns 404 if no token found.",
        docsUrl: "https://docs.asksurf.ai/data-api/token/tokenomics",
        categories: ["onchain-data"],
        notes: [
            "Pass at least one of `id` or `symbol`; `id` takes " +
            "priority when several are given. A request with none is " +
            "rejected before the wire.",
        ],
    },
    request: { method: "GET", path: "/token/tokenomics" },
    input: {
        schema: {
            // the identifier alternatives compile to anyOf (D4); a union arm
            // takes no binding default (ajv never applies defaults inside anyOf)
            queryParams: z.union([
                zTokenTokenomicsQueryParams.required({ id: true }),
                zTokenTokenomicsQueryParams.required({ symbol: true }),
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
