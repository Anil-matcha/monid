import { z } from "zod";

/**
 * Shared fragments for the Fundable endpoint schemas (ported from v1
 * endpoints/common.ts). Faithful vendor mirror: optionality only — the
 * platform's own tightening (`page_size` required + capped at 100) lives at
 * each endpoint's binding (design D25).
 *
 * PORT NOTE: v1 guarded two cross-field rules with `.superRefine()` on the
 * live zod schema — "a POST search body must be non-empty" and "a lookup
 * names EXACTLY ONE identifier". Those checks cannot be represented in the
 * compiled JSON Schema (design D6), so here they are DOCUMENTED constraints
 * in the describes; Fundable itself answers 400/422 (error-as-data). The
 * non-empty-body rule is moot in v2: `page_size` is required at every POST
 * binding, so a body is never `{}`.
 */

/** Platform cap on `page_size` (upstream allows 500) — v1 decision
 *  (2026-09-01): bounds the admission hold of a row-billed run. Applied at
 *  each row-billed endpoint's binding, never in the mirror. */
export const PAGE_SIZE_MAX = 100;

export const zUuid = z.uuid();

/** Non-empty list of UUIDs. */
export const zUuids = z.array(zUuid).min(1);

/** Path identifier shared by GET /deals/{id} and GET /deals/{id}/investors. */
export const zDealId = zUuid.describe("Deal UUID.");

// z.iso.date() compiles to a calendar-aware pattern (month/day bounds, leap
// years) — real validation survives into the compiled doc, unlike a .refine.
export const zDate = z.iso.date().describe("Date formatted as YYYY-MM-DD.");

export const zUsd = z.number().min(0);

/** Non-empty list of non-empty strings, optionally capped (vendor refuses
 *  empty arrays — v1 evidence). */
export const zStrings = (max?: number) => {
    const items = z.array(z.string().min(1)).min(1);
    return max === undefined ? items : items.max(max);
};

export const zPagination = {
    page: z.number().int().min(0).optional().describe(
        "Page number (0-based). Default 0.",
    ),
    // upstream default 10, upstream max 500; the platform binding requires
    // it and caps it at PAGE_SIZE_MAX
    page_size: z.number().int().min(1).max(500).describe(
        "Rows per page. Billing is per row returned.",
    ).optional(),
};

const PERMALINK_NOTE =
    "A value that is not an exact permalink is silently ignored and " +
    "returns zero rows.";

export const zLocationPermalinks = zStrings().describe(
    "Location permalinks (e.g. 'san-francisco-california'). Resolve names " +
        "with /location/search first. " + PERMALINK_NOTE,
);

export const zIndustryPermalinks = zStrings().describe(
    "Industry permalinks (e.g. 'fintech-e067'). Resolve names with " +
        "/industry/search first. " + PERMALINK_NOTE,
);

export const zSuperCategoryPermalinks = zStrings().describe(
    "Super-category permalinks (e.g. 'artificial-intelligence-e551'); " +
        "each automatically includes its related industries. Resolve with " +
        "/industry/search. " + PERMALINK_NOTE,
);

const FINANCING_TYPES = [
    "SERIES_A",
    "SERIES_B",
    "SERIES_C",
    "SERIES_D",
    "SERIES_E",
    "SERIES_F",
    "SERIES_G",
    "SERIES_H",
    "SERIES_I",
    "SERIES_J",
    "SERIES_K",
    "SERIES_L",
    "SERIES_M",
    "SEED",
    "SAFE",
    "CONVERTIBLE_NOTE",
    "EQUITY",
    "PREFERRED",
    "SECONDARY_MARKET",
    "DEBT_FINANCING",
    "GRANT",
    "NON_EQUITY_ASSISTANCE",
    "CROWDFUNDING",
    "INITIAL_COIN_OFFERING",
    "FUNDING_ROUND",
] as const;

export const zFinancingType = z.object({
    type: z.enum(FINANCING_TYPES).describe(
        "Canonical round type (e.g. SERIES_A, SEED) — not the human label.",
    ),
    pre: z.boolean().optional().describe(
        "Pre-round modifier (Pre-Seed, Pre-Series A). Default false.",
    ),
    extension: z.boolean().optional().describe(
        "Extension-round modifier. Default false.",
    ),
}).strict();

export const zFinancingTypes = z.array(zFinancingType).min(1).describe(
    "Round types with optional pre/extension modifiers. An invalid type " +
        "returns 422.",
);

export const zEmployeeCounts = z.array(
    z.enum([
        "1-10",
        "11-50",
        "51-100",
        "101-250",
        "251-500",
        "501-1000",
        "1001-5000",
        "5001-10000",
        "10001+",
    ]),
).min(1).describe("Employee count ranges.");

export const zIpoStatuses = z.array(z.enum(["public", "private"])).min(1)
    .describe("IPO status filter.");

export const zSearchQuery = z.string().min(1).describe(
    "AI-powered semantic search — describe what the company does (product, " +
        "technology, business model) as a flexible replacement for an " +
        "industry tag. Results sort by relevance and sort_by is ignored. " +
        "Subject to an account-wide monthly semantic-search ceiling (429 " +
        "USAGE_LIMIT_EXCEEDED) and may time out (504).",
);

export const zMinRelevance = z.number().min(0).max(1).describe(
    "Minimum similarity threshold (0-1). Only applies with search_query.",
);

/** Documented cross-field rule for the identifier lookups (design D6):
 *  the vendor wants exactly one identifier. */
export const EXACTLY_ONE_ORG =
    "Provide EXACTLY ONE of id, domain, linkedin, crunchbase — Fundable " +
    "rejects zero or several identifiers.";

export const EXACTLY_ONE_PERSON =
    "Provide EXACTLY ONE of id, linkedin, crunchbase, twitter — Fundable " +
    "rejects zero or several identifiers.";

/** Query identifiers shared by the company and investor lookups. */
export const zOrgIdentifiers = {
    id: zUuid.optional().describe("Fundable UUID."),
    domain: z.string().min(1).optional().describe(
        "Website domain or full URL (e.g. 'stripe.com' or " +
            "'https://stripe.com'); URLs are parsed to the domain.",
    ),
    linkedin: z.string().min(1).optional().describe("LinkedIn company URL."),
    crunchbase: z.string().min(1).optional().describe(
        "Crunchbase organization URL.",
    ),
};

/** Query identifiers shared by the person lookups. */
export const zPersonIdentifiers = {
    id: zUuid.optional().describe("Fundable person UUID."),
    linkedin: z.string().min(1).optional().describe("LinkedIn person URL."),
    crunchbase: z.string().min(1).optional().describe(
        "Crunchbase person URL.",
    ),
    twitter: z.string().min(1).optional().describe("Twitter/X URL."),
};
