import { z } from "zod";

/**
 * Shared zod fragments for the Clay endpoint schemas (ported from v1
 * `adaptors/clay/endpoints/common.ts`). Faithful vendor mirror: optionality
 * only, no `.default()` — the platform's own tightening (`limit` REQUIRED
 * at the search-run binding) lives at the endpoint (design D25).
 *
 * KEY CASING: the curated enrichment functions take Clay's own capitalized,
 * space-bearing input keys ("Company Name", "Social Profile URL") verbatim,
 * so there is no rename shim to drift. Quoted keys are the vendor's truth
 * here, not a style choice.
 */

/** Plan cap on a search page (upstream default 20, Launch cap 500). */
export const SEARCH_LIMIT_MAX = 500;

// ── Search ──────────────────────────────────────────────────────────────────

/** The handle returned by `POST /search/query-mode`. */
export const zSearchId = z.string().min(1).describe(
    "The search_id returned by the create-advanced-search endpoint. The " +
        "iterator is forward-only and server-side: each run call returns " +
        "the next page. Searches expire upstream — a 404 ('Search not " +
        "found or expired') means create a new search.",
);

/** Page size for a search run — the primary limiting knob. */
export const zSearchLimit = z.number().int().min(1).max(SEARCH_LIMIT_MAX)
    .describe(
        "Results to return for this page (1-500). Billing is per row " +
            "actually returned, so a short final page draws less.",
    );

// ── Curated enrichment inputs (upstream schema keys, verbatim) ──────────────

export const zCompanyDomainField = z.string().min(1).describe(
    "The company's website domain, e.g. 'clay.com'. Resolve a bare " +
        "company name with the company-domain endpoint first.",
);

/** On a company function this is the subject; on a person function it is
 *  the company the person works at. Each binding says which. */
export const zCompanyNameField = z.string().min(1).describe(
    "The company's name, e.g. 'Clay'.",
);

export const zCompanySocialProfileField = z.string().min(1).describe(
    "The company's social profile URL, e.g. its LinkedIn page (optional " +
        "disambiguation aid).",
);

export const zFullNameField = z.string().min(1).describe(
    "The person's full name, e.g. 'Kareem Amin'.",
);

export const zPersonSocialProfileField = z.string().min(1).describe(
    "The person's LinkedIn profile URL, e.g. " +
        "'https://www.linkedin.com/in/kareemamin'.",
);

export const zPersonalEmailField = z.string().min(1).describe(
    "The person's personal email address (optional extra clue).",
);

export const zWorkEmailField = z.string().min(1).describe(
    "The person's work email address (optional extra clue).",
);
