import { z } from "zod";
import {
    zDate,
    zEmployeeCounts,
    zFinancingTypes,
    zIndustryPermalinks,
    zIpoStatuses,
    zLocationPermalinks,
    zPagination,
    zSuperCategoryPermalinks,
    zUsd,
    zUuids,
} from "../../../schema/common.ts";

/** POST /deals body — the filtered funding-round search (ported from v1). */
export const zDealsSearchBody = z.object({
    identifiers: z.object({
        deal_ids: zUuids.optional().describe("Deal UUIDs to look up."),
    }).strict().optional(),
    deal: z.object({
        financing_types: zFinancingTypes.optional(),
        size_min: zUsd.optional().describe("Minimum round size (USD)."),
        size_max: zUsd.optional().describe("Maximum round size (USD)."),
        date_start: zDate.optional().describe("Announced on or after."),
        date_end: zDate.optional().describe("Announced on or before."),
        created_start: zDate.optional().describe(
            "Added to Fundable on or after (ingestion date, not announcement).",
        ),
        created_end: zDate.optional().describe(
            "Added to Fundable on or before (ingestion date).",
        ),
    }).strict().optional().describe("Round attribute filters."),
    company: z.object({
        company_ids: zUuids.optional().describe("Company UUIDs."),
        locations: zLocationPermalinks.optional(),
        industries: zIndustryPermalinks.optional(),
        super_categories: zSuperCategoryPermalinks.optional(),
        employee_count: zEmployeeCounts.optional(),
        ipo_status: zIpoStatuses.optional(),
        total_raised_min: zUsd.optional().describe(
            "Minimum total raised by the company (USD).",
        ),
        total_raised_max: zUsd.optional().describe(
            "Maximum total raised by the company (USD).",
        ),
    }).strict().optional().describe("Raising-company attribute filters."),
    investors: z.object({
        investor_ids: zUuids.optional().describe(
            "Firm investor UUIDs that participated.",
        ),
        people_ids: zUuids.optional().describe(
            "Person UUIDs that participated as an angel or as lead partner " +
                "of an investing firm.",
        ),
    }).strict().optional().describe("Investor participation filters."),
    ...zPagination,
    sort_by: z.enum([
        "most_recent_deal",
        "oldest_deal",
        "largest_raise",
        "smallest_raise",
    ]).optional().describe("Sort order. Default most_recent_deal."),
}).strict();
