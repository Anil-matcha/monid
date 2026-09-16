import { z } from "zod";
import {
    zDate,
    zEmployeeCounts,
    zFinancingTypes,
    zIndustryPermalinks,
    zIpoStatuses,
    zLocationPermalinks,
    zMinRelevance,
    zPagination,
    zSearchQuery,
    zStrings,
    zSuperCategoryPermalinks,
    zUsd,
    zUuids,
} from "../../../schema/common.ts";

/** POST /investors body — the filtered investor list (ported from v1). */
export const zInvestorsSearchBody = z.object({
    identifiers: z.object({
        ids: zUuids.optional().describe("Investor UUIDs."),
        domains: zStrings(100).optional().describe(
            "Investor domains (max 100).",
        ),
        linkedin_urls: zStrings(100).optional().describe(
            "Investor LinkedIn URLs (max 100).",
        ),
        crunchbase_urls: zStrings(100).optional().describe(
            "Investor Crunchbase URLs (max 100).",
        ),
    }).strict().optional().describe(
        "Batch lookup by identifier (OR'd); rows are still capped by page_size.",
    ),
    investor: z.object({
        locations: zLocationPermalinks.optional().describe(
            "Investor HQ location permalinks. Resolve with /location/search.",
        ),
        employee_count: zEmployeeCounts.optional().describe(
            "Investor firm headcount ranges.",
        ),
    }).strict().optional().describe("Investor entity filters."),
    company_investments: z.object({
        company_ids: zUuids.optional().describe("Portfolio company UUIDs."),
        search_query: zSearchQuery.optional().describe(
            "Semantic search matched against each investor's portfolio " +
                "companies. Subject to the monthly semantic-search ceiling.",
        ),
        min_relevance: zMinRelevance.optional(),
        locations: zLocationPermalinks.optional().describe(
            "Portfolio company location permalinks.",
        ),
        industries: zIndustryPermalinks.optional().describe(
            "Portfolio company industry permalinks.",
        ),
        super_categories: zSuperCategoryPermalinks.optional(),
        employee_count: zEmployeeCounts.optional().describe(
            "Portfolio company headcount ranges.",
        ),
        ipo_status: zIpoStatuses.optional().describe(
            "Portfolio company IPO status.",
        ),
        total_raised_min: zUsd.optional().describe(
            "Minimum total raised by portfolio companies (USD).",
        ),
        total_raised_max: zUsd.optional().describe(
            "Maximum total raised by portfolio companies (USD).",
        ),
        financing_types: zFinancingTypes.optional(),
        deal_size_min: zUsd.optional().describe("Minimum deal size (USD)."),
        deal_size_max: zUsd.optional().describe("Maximum deal size (USD)."),
        deal_start_date: zDate.optional().describe("Deals on or after."),
        deal_end_date: zDate.optional().describe("Deals on or before."),
        only_lead_deals: z.boolean().optional().describe(
            "Count only deals the investor led. Default false.",
        ),
        min_matching_deals: z.number().int().min(1).optional().describe(
            "Minimum number of deals matching the portfolio filters.",
        ),
    }).strict().optional().describe(
        "Portfolio filters; when set, each investor row also carries " +
            "filtered_deal_count and filtered_lead_count.",
    ),
    ...zPagination,
    sort_by: z.enum([
        "most_recent_deal",
        "recent_deals",
        "deals_led_ltm",
        "total_deals",
        "matching_deals",
    ]).optional().describe("Sort order. Default most_recent_deal."),
}).strict();
