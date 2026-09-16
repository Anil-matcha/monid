import { z } from "zod";
import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zFundDetailQueryParams } from "./schema/inputs.ts";

/**
 * GET /fund/detail — Light tier, 1 Surf credit per call.
 */
export default defineEndpoint({
    meta: {
        displayName: "Fund Profile Detail",
        summary: "Returns a crypto VC fund's full profile: description, " +
            "jurisdiction, portfolio count, social links, and team " +
            "members with roles.",
        description: "Returns a crypto VC fund's full profile: description, " +
            "jurisdiction, portfolio count, social links, and team " +
            "members with roles. Included fields: X accounts, team " +
            "members, recent research, invested project count. This " +
            "does NOT return the list of investments — use " +
            "/fund/portfolio for that. Lookup: by UUID (id) or name " +
            "(q). Returns 404 if not found.",
        docsUrl: "https://docs.asksurf.ai/data-api/fund/detail",
        categories: ["company-enrichment", "funding-data"],
        notes: [
            "Pass at least one of `id` or `q`; `id` takes priority " +
            "when several are given. A request with none is rejected " +
            "before the wire.",
        ],
    },
    request: { method: "GET", path: "/fund/detail" },
    input: {
        schema: {
            // the identifier alternatives compile to anyOf (D4); a union arm
            // takes no binding default (ajv never applies defaults inside anyOf)
            queryParams: z.union([
                zFundDetailQueryParams.required({ id: true }),
                zFundDetailQueryParams.required({ q: true }),
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
