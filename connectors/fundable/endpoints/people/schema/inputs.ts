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

const zLatestDealFilters = z.object({
    financing_types: zFinancingTypes.optional(),
    size_min: zUsd.optional().describe("Minimum latest-round size (USD)."),
    size_max: zUsd.optional().describe("Maximum latest-round size (USD)."),
    date_start: zDate.optional().describe("Latest round on or after."),
    date_end: zDate.optional().describe("Latest round on or before."),
    investor_ids: zUuids.optional().describe(
        "Investor UUIDs that participated in the latest round.",
    ),
    investor_locations: zLocationPermalinks.optional().describe(
        "HQ location permalinks of investors on the latest round.",
    ),
}).strict();

/** POST /people body — the filtered people search (ported from v1). */
export const zPeopleSearchBody = z.object({
    person_type: z.enum(["company", "investor", "any"]).optional().describe(
        "Population: 'company' = people with a current employer (founders, " +
            "executives, employees); 'investor' = people who invest; 'any' " +
            "(default) = both.",
    ),
    identifiers: z.object({
        ids: zUuids.optional().describe("Person UUIDs."),
        linkedin_urls: zStrings(100).optional().describe(
            "LinkedIn person URLs (max 100).",
        ),
        crunchbase_urls: zStrings(100).optional().describe(
            "Crunchbase person URLs (max 100).",
        ),
        twitter_urls: zStrings(100).optional().describe(
            "Twitter/X URLs (max 100).",
        ),
    }).strict().optional().describe(
        "Batch lookup by identifier; rows are still capped by page_size.",
    ),
    person: z.object({
        roles: z.array(z.enum(["founder", "ceo", "key_person"])).min(1)
            .optional().describe("Role at the current employer."),
        contact_types: z.array(
            z.enum(["linkedin", "email", "phone", "twitter"]),
        ).min(1).optional().describe(
            "Contact info the person has on file.",
        ),
        job_titles: zStrings().optional().describe(
            "Normalized job-title keys.",
        ),
        education_schools: zStrings().optional().describe(
            "Education institution ids.",
        ),
        linkedin_companies: zStrings().optional().describe(
            "Previous or current employer LinkedIn company ids.",
        ),
    }).strict().optional().describe("Person attribute filters."),
    company: z.object({
        search_query: zSearchQuery.optional().describe(
            "Semantic search against the person's current employer. Subject " +
                "to the monthly semantic-search ceiling.",
        ),
        min_relevance: zMinRelevance.optional(),
        ids: zUuids.optional().describe("Current-employer UUIDs."),
        locations: zLocationPermalinks.optional(),
        industries: zIndustryPermalinks.optional(),
        super_categories: zSuperCategoryPermalinks.optional(),
        employee_count: zEmployeeCounts.optional().describe(
            "Current-employer headcount ranges.",
        ),
        ipo_status: z.array(
            z.enum(["public", "private", "acquired", "delisted"]),
        ).min(1).optional().describe("Current-employer IPO status."),
        total_raised_min: zUsd.optional().describe(
            "Minimum total raised by the current employer (USD).",
        ),
        total_raised_max: zUsd.optional().describe(
            "Maximum total raised by the current employer (USD).",
        ),
        investor_people_ids: zUuids.optional().describe(
            "Person UUIDs — keep people whose employer ever raised from any " +
                "of them as an angel or lead partner.",
        ),
        latest_deal: zLatestDealFilters.optional().describe(
            "Filters on the current employer's most recent round.",
        ),
    }).strict().optional().describe(
        "Current-employer filters; setting any requires a current employer.",
    ),
    investor: z.object({
        ids: zUuids.optional().describe("Firm (parent investor) UUIDs."),
        domains: zStrings(100).optional().describe("Firm domains (max 100)."),
        linkedin_urls: zStrings(100).optional().describe(
            "Firm LinkedIn URLs (max 100).",
        ),
        crunchbase_urls: zStrings(100).optional().describe(
            "Firm Crunchbase URLs (max 100).",
        ),
        permalinks: zStrings(100).optional().describe(
            "Fundable firm permalinks (max 100).",
        ),
        locations: zLocationPermalinks.optional().describe(
            "Firm HQ location permalinks.",
        ),
        employee_count: zEmployeeCounts.optional().describe(
            "Firm headcount ranges.",
        ),
        deals: z.object({
            search_query: zSearchQuery.optional().describe(
                "Semantic search against the person's portfolio companies. " +
                    "Subject to the monthly semantic-search ceiling.",
            ),
            min_relevance: zMinRelevance.optional(),
            investment_type: z.enum(["all", "angel", "institutional"])
                .optional().describe(
                    "Angel deals, firm deals, or both (default all).",
                ),
            only_lead_deals: z.boolean().optional().describe(
                "Count only deals the person or firm led. Default false.",
            ),
            min_matching_deals: z.number().int().min(1).optional().describe(
                "Require at least this many matching deals.",
            ),
            financing_types: zFinancingTypes.optional(),
            size_min: zUsd.optional().describe("Minimum deal size (USD)."),
            size_max: zUsd.optional().describe("Maximum deal size (USD)."),
            date_start: zDate.optional().describe("Deals on or after."),
            date_end: zDate.optional().describe("Deals on or before."),
            industries: zIndustryPermalinks.optional().describe(
                "Portfolio company industry permalinks.",
            ),
            super_categories: zSuperCategoryPermalinks.optional(),
            portfolio_locations: zLocationPermalinks.optional().describe(
                "Portfolio company location permalinks.",
            ),
            portfolio_employee_count: zEmployeeCounts.optional().describe(
                "Portfolio company headcount ranges.",
            ),
            ipo_status: zIpoStatuses.optional().describe(
                "Portfolio company IPO status.",
            ),
            total_raised_min: zUsd.optional().describe(
                "Minimum total raised by the portfolio company (USD).",
            ),
            total_raised_max: zUsd.optional().describe(
                "Maximum total raised by the portfolio company (USD).",
            ),
        }).strict().optional().describe(
            "Deal-activity and portfolio filters; when set, rows carry " +
                "filtered_deal_count, filtered_lead_count and " +
                "filtered_most_recent_date.",
        ),
    }).strict().optional().describe(
        "Investor filters; setting any requires the person to be an investor.",
    ),
    ...zPagination,
    sort_by: z.enum([
        "most_recent_deal_date",
        "total_raised",
        "latest_deal_size",
        "name",
        "total_deal_count",
        "deal_count_last_12_months",
        "lead_deal_count",
        "lead_deal_count_last_12_months",
        "filtered_deal_count",
    ]).optional().describe(
        "Sort order. Default most_recent_deal_date; non-applicable keys " +
            "sort to the bottom.",
    ),
}).strict();
