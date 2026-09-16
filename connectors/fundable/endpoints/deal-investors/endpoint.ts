import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zDealPathParams } from "./schema/inputs.ts";

/** GET /deals/{id}/investors — the round's investor lineup, flat per call. */
export default defineEndpoint({
    meta: {
        displayName: "Get Round Investors",
        summary: "Get investors for a specific funding round.",
        description: "List the full investor lineup of one funding round by " +
            "deal UUID. Returns firm investors with lead_investor flag, " +
            "financing_type, domain, LinkedIn and Crunchbase links, and " +
            "the partner personnel involved (person id, name, LinkedIn, " +
            "Crunchbase, Twitter); angel investors are returned separately " +
            "with their profile links. Flat price per call regardless of " +
            "investor count. Suited for co-investor and syndicate research " +
            "and for finding the partner who led a round.",
        docsUrl: "https://docs.tryfundable.ai/api-reference/deals/investors",
        categories: ["funding-data"],
    },
    /** PUBLIC identity (design D22): see endpoints/deal/endpoint.ts —
     *  v1 id `/deals/{id}/investors`. */
    endpoint: "/deal/investors",
    request: { method: "GET", path: "/deals/{id}/investors" },
    input: { schema: { pathParams: zDealPathParams } },
    usage: {
        /** 1 credit per call — v1 drill (2026-09-01): "1 credit for a
         *  5-investor deal and for an empty array". */
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "lookup",
            consumes: { credit: "default", amount: 1 },
        },
    },
});
