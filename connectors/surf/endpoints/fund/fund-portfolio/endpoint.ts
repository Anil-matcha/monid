import { z } from "zod";
import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zFundPortfolioQueryParams } from "./schema/inputs.ts";

/**
 * GET /fund/portfolio — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Fund Portfolio",
        summary: "Returns investment rounds for a fund's portfolio, " +
            "sorted by date (newest first).",
        description: "Returns investment rounds for a fund's portfolio, " +
            "sorted by date (newest first). A project may appear " +
            "multiple times if the fund participated in multiple " +
            "rounds. Included fields: project name, logo, date, " +
            "raise amount, lead investor status. Lookup: by UUID " +
            "(id) or name (q).",
        docsUrl: "https://docs.asksurf.ai/data-api/fund/portfolio",
        categories: ["company-enrichment", "funding-data"],
        notes: [
            "Pass at least one of `id` or `q`; `id` takes priority " +
            "when several are given. A request with none is rejected " +
            "before the wire.",
        ],
    },
    request: { method: "GET", path: "/fund/portfolio" },
    input: {
        schema: {
            // the identifier alternatives compile to anyOf (D4); a union arm
            // takes no binding default (ajv never applies defaults inside anyOf)
            queryParams: z.union([
                zFundPortfolioQueryParams.required({ id: true }),
                zFundPortfolioQueryParams.required({ q: true }),
            ]),
        },
    },
    usage: {
        // Surf's published Light tier — v1 makePerCallPrice(surfCredits(1)),
        // the balance-differencing drills of 2026-08 (design D1)
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "call",
            consumes: { credit: "default", amount: 1 },
        },
    },
});
