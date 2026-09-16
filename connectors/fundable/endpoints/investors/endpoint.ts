import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { PAGE_SIZE_MAX } from "../../schema/common.ts";
import { zInvestorsSearchBody } from "./schema/inputs.ts";

/** POST /investors — filtered investor list, billed per row. */
export default defineEndpoint({
    meta: {
        displayName: "Search Investors",
        summary: "List and filter venture firms and institutional investors.",
        description: "List venture firms and institutional investors " +
            "filtered by HQ location and headcount, or by portfolio: " +
            "semantic description, portfolio company location, industry, " +
            "super category, headcount, IPO status, total raised, round " +
            "types, deal size and date, lead-only, and a minimum " +
            "matching-deal count; or batch-look-up up to 100 domains, " +
            "LinkedIn or Crunchbase URLs. Returns per investor: id, name, " +
            "guru_permalink, description, domain, website, LinkedIn, " +
            "PitchBook and Crunchbase links, investment_stage, " +
            "contact_email and contact_phone when available, location, " +
            "total_deal_count, lead_deal_count, deal_count_last_12_months, " +
            "most_recent_deal_date, top_industries, top_locations, " +
            "top_round_types, and matched-deal counts when portfolio " +
            "filters are set. Location, industry and super-category " +
            "filters take exact permalinks — resolve names with " +
            "/location/search and /industry/search first. Suited for " +
            "investor discovery for founders and LP or co-investor " +
            "research.",
        docsUrl: "https://docs.tryfundable.ai/api-reference/investors/list",
        categories: ["funding-data"],
    },
    request: { method: "POST", path: "/investors" },
    // `page_size` REQUIRED and CAPPED at the binding (design D25; see
    // endpoints/deals/endpoint.ts for the rule).
    input: {
        schema: {
            body: zInvestorsSearchBody.extend({
                page_size: zInvestorsSearchBody.shape.page_size.unwrap()
                    .max(PAGE_SIZE_MAX),
            }),
        },
    },
    usage: {
        /** 1 credit per returned row — v1 drill (2026-09-01). Settle is
         *  inherited (provider evidence counts `data.investors`). */
        model: {
            kind: UsageModelKind.PER_UNIT,
            unit: Unit.RESULT,
            label: "rows",
            consumes: { credit: "default", amount: 1 },
        },
        estimate: ({ data }) => ({
            counts: { "RESULT": data.input.body.page_size },
        }),
    },
});
