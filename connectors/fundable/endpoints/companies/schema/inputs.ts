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

/** POST /companies body — the filtered funded-company search (ported from v1). */
export const zCompaniesSearchBody = z.object({
    identifiers: z.object({
        ids: zUuids.optional().describe("Company UUIDs."),
        domains: zStrings(100).optional().describe(
            "Company domains (max 100).",
        ),
        linkedin_urls: zStrings(100).optional().describe(
            "LinkedIn company URLs (max 100).",
        ),
        crunchbase_urls: zStrings(100).optional().describe(
            "Crunchbase organization URLs (max 100).",
        ),
    }).strict().optional().describe(
        "Batch lookup by identifier; rows are still capped by page_size.",
    ),
    company: z.object({
        search_query: zSearchQuery.optional(),
        min_relevance: zMinRelevance.optional(),
        locations: zLocationPermalinks.optional(),
        industries: zIndustryPermalinks.optional(),
        super_categories: zSuperCategoryPermalinks.optional(),
        employee_count: zEmployeeCounts.optional(),
        ipo_status: zIpoStatuses.optional(),
        total_raised_min: zUsd.optional().describe(
            "Minimum total raised (USD).",
        ),
        total_raised_max: zUsd.optional().describe(
            "Maximum total raised (USD).",
        ),
    }).strict().optional().describe("Company attribute filters."),
    latest_deal: z.object({
        financing_types: zFinancingTypes.optional(),
        size_min: zUsd.optional().describe("Minimum latest-round size (USD)."),
        size_max: zUsd.optional().describe("Maximum latest-round size (USD)."),
        date_start: zDate.optional().describe(
            "Latest round announced on or after.",
        ),
        date_end: zDate.optional().describe(
            "Latest round announced on or before.",
        ),
        created_start: zDate.optional().describe(
            "Latest round added to Fundable on or after (ingestion date) — " +
                "the better checkpoint for signal-based outbound.",
        ),
        created_end: zDate.optional().describe(
            "Latest round added to Fundable on or before.",
        ),
        investor_ids: zUuids.optional().describe(
            "Investors that participated in the latest round only.",
        ),
    }).strict().optional().describe("Latest funding round filters."),
    investors: z.object({
        investor_ids: zUuids.optional().describe(
            "Firm investor UUIDs that participated in any round.",
        ),
        people_ids: zUuids.optional().describe(
            "Person UUIDs that participated in any round as an angel or as " +
                "lead partner of an investing firm.",
        ),
    }).strict().optional().describe("Investor filters across all rounds."),
    ...zPagination,
    sort_by: z.enum([
        "most_recent_raise",
        "oldest_raise",
        "most_recent_founded",
        "oldest_founded",
        "largest_valuation",
        "smallest_valuation",
        "largest_total_raise",
        "smallest_total_raise",
        "most_funding_rounds",
        "most_investors",
    ]).optional().describe(
        "Sort order. Default most_recent_raise. Ignored with search_query.",
    ),
}).strict();
