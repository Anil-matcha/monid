import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zInvestorQueryParams } from "./schema/inputs.ts";

/** GET /investor — one investor firm by identifier, flat per call. */
export default defineEndpoint({
    meta: {
        displayName: "Get Investor Profile",
        summary: "Get investor details and statistics by identifier.",
        description: "Fetch one investor firm by UUID, domain, LinkedIn URL, " +
            "or Crunchbase URL (exactly one). Returns name, legal_name, " +
            "description, domain, website, LinkedIn, PitchBook and " +
            "Crunchbase links, investment_stage, headcount range, " +
            "contact_email and contact_phone when available, location " +
            "hierarchy, total_deal_count, lead_deal_count, deal counts " +
            "over the last 12 months, most_recent_deal_date, and " +
            "top_industries, top_locations and top_round_types with " +
            "counts. Resolve a name into an id or domain with " +
            "/investor/search first. Suited for qualifying a fund's stage, " +
            "sector and geography focus before outreach.",
        docsUrl: "https://docs.tryfundable.ai/api-reference/investors/get",
        categories: ["funding-data"],
    },
    request: { method: "GET", path: "/investor" },
    input: { schema: { queryParams: zInvestorQueryParams } },
    usage: {
        /** 1 credit per call — v1 drill (2026-09-01). */
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "lookup",
            consumes: { credit: "default", amount: 1 },
        },
    },
});
