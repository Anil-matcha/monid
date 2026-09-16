import { z } from "zod";
import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zProjectDefiMetricsQueryParams } from "./schema/inputs.ts";

/**
 * GET /project/defi/metrics — Standard tier, 2 Surf credits per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Project DeFi Metrics",
        summary: "Returns historical time-series for a single DeFi " +
            "protocol metric (e.g. daily TVL).",
        description: "Returns historical time-series for a single DeFi " +
            "protocol metric (e.g. daily TVL). Each data point has a " +
            "Unix timestamp and value. Available metrics: volume, " +
            "fee, fees, revenue, tvl, users. Lookup: by UUID (id) or " +
            "name (q). Filter by chain and date range (from/to). " +
            "Returns 404 if the project is not found. Pagination: " +
            "check meta.has_more; when true, increase offset or " +
            "limit to fetch the remaining points. Note: this " +
            "endpoint only returns data for DeFi protocol projects " +
            "(e.g. aave, uniswap, lido, makerdao). Use q with a DeFi " +
            "protocol name.",
        docsUrl: "https://docs.asksurf.ai/data-api/project/defi-metrics",
        categories: ["defi"],
        notes: [
            "Pass at least one of `id` or `q`; `id` takes priority " +
            "when several are given. A request with none is rejected " +
            "before the wire.",
        ],
    },
    request: { method: "GET", path: "/project/defi/metrics" },
    input: {
        schema: {
            // the identifier alternatives compile to anyOf (D4); a union arm
            // takes no binding default (ajv never applies defaults inside anyOf)
            queryParams: z.union([
                zProjectDefiMetricsQueryParams.required({ id: true }),
                zProjectDefiMetricsQueryParams.required({ q: true }),
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
