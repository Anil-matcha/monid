import { z } from "zod";

/**
 * Shared zod fragments for the Ahrefs endpoint schemas (ported from v1
 * `adaptors/ahrefs/endpoints/common.ts`). Faithful vendor mirror:
 * optionality only, no `.default()` — the vendor defaults v1 pinned in
 * the mirror (`mode` subdomains, `protocol` both, `history_grouping`
 * monthly) move to each endpoint's binding, and the row budgets (`limit`,
 * `top_positions`) are REQUIRED there (design D25: the caller states the
 * cap the hold is priced from).
 *
 * THE FIELD-SET CONTRACT (pricing-critical, design D4): the vendor prices
 * each row by the UNIQUE fields across `select` / `where` / `order_by`.
 * Every endpoint injects a fixed `select` list, and `zOrderBy` / `zWhere`
 * restrict the caller's sort and filter to that same list — as JSON
 * Schema `pattern`s, since a `.superRefine` would not survive
 * compilation — so the per-row unit cost never drifts from the authored
 * constant.
 */

/** A target: root domain, subdomain, or full URL. */
export const zTarget = z.string().min(1).describe(
    "The target of the report: a domain ('example.com') or a URL " +
        "('https://example.com/page').",
);

/** Target scope. Vendor default: subdomains (applied at the binding). */
export const zMode = z.enum(["exact", "prefix", "domain", "subdomains"])
    .describe(
        "Scope of the target: exact (this URL only), prefix (URLs starting " +
            "with the target), domain (the domain without subdomains), or " +
            "subdomains (default — the domain and all its subdomains).",
    );

/** Protocol filter. Vendor default: both (applied at the binding). */
export const zProtocol = z.enum(["both", "http", "https"]).describe(
    "Protocol of the target: both (default), http, or https.",
);

/** Plan cap on rows per request (Lite plan; the vendor's own default of
 *  1,000 rows exceeds it). */
export const AHREFS_MAX_ROWS = 100;

/**
 * Row budget — the cost basis of every rowed report (each returned row is
 * billed at the endpoint's units-per-row rate). Optional in the mirror,
 * REQUIRED at every binding that uses it.
 */
export const zLimit = z.number().int().min(1).max(AHREFS_MAX_ROWS).describe(
    "Maximum number of rows to return (1-100). This is the cost budget — " +
        "billing is per returned row.",
);

/** Two-letter country code (ISO 3166-1 alpha-2). */
export const zCountry = z.string().length(2).describe(
    "Two-letter country code (ISO 3166-1 alpha-2), e.g. 'us'.",
);

/** A report date (YYYY-MM-DD); use today's date for current data. */
export const zDate = z.iso.date().describe(
    "Report date in YYYY-MM-DD format. Use today's date for current values.",
);

/** History range start (YYYY-MM-DD). */
export const zDateFrom = z.iso.date().describe(
    "Start date of the historical period in YYYY-MM-DD format.",
);

/** History range end (YYYY-MM-DD). The vendor defaults it to today;
 *  every history binding REQUIRES it, because the hold counts date
 *  buckets and a hook fn has no clock (design D6). */
export const zDateTo = z.iso.date().describe(
    "End date of the historical period in YYYY-MM-DD format.",
);

/** Vendor cap on history buckets per request. */
export const AHREFS_MAX_HISTORY_BUCKETS = 60;

/** History bucket size. Vendor default: monthly (applied at the binding). */
export const zHistoryGrouping = z.enum(["daily", "weekly", "monthly"])
    .describe(
        "Time bucket size for history rows: daily, weekly, or monthly " +
            "(default). Each bucket is one billed row; a range may span at " +
            "most 60 buckets.",
    );

/** A single keyword. */
export const zKeyword = z.string().min(1).describe("The keyword to analyze.");

/** A keyword list — joined onto the comma-separated wire parameter by the
 *  endpoint's `toRequest`. */
export const zKeywords = z.array(z.string().min(1)).min(1).max(100).describe(
    "Keywords to analyze (up to 100). Each returned keyword is one billed " +
        "row.",
);

/**
 * `order_by` restricted to the endpoint's fixed field set, as a PATTERN:
 * tokens `field` or `field:asc|desc`, comma-separated (or exactly one
 * token when `single`). Restricting to the field set keeps the sort free
 * — those fields are already paid for in `select`.
 */
export function zOrderBy(
    fields: readonly string[],
    /**
     * Endpoints whose sortable set is NARROWER than their `select` set
     * (`title_target`, `http_code_target` 400 upstream although the spec
     * lists them), or that accept only ONE sort token (`crawled-pages`
     * parses a comma list as one field name). Both drill-measured in v1.
     */
    opts: { sortable?: readonly string[]; single?: boolean } = {},
) {
    const sortable = opts.sortable ?? fields;
    const token = `(?:${sortable.join("|")})(?::(?:asc|desc))?`;
    const pattern = opts.single
        ? new RegExp(`^${token}$`)
        : new RegExp(`^${token}(?:,${token})*$`);
    const listed = sortable.join(", ");
    return z.string().regex(
        pattern,
        `order_by: 'field' or 'field:asc|desc'${
            opts.single ? " (one field only)" : ", comma-separated"
        }, with a field from: ${listed}`,
    ).describe(
        opts.single
            ? "Sort order: 'field' or 'field:desc' (one field only). " +
                `Sortable fields: ${listed}.`
            : "Sort order: 'field' or 'field:desc', comma-separated. " +
                `Sortable fields: ${listed}.`,
    );
}

/**
 * `where` (the Ahrefs JSON filter expression, as a string) restricted to
 * the endpoint's fixed field set, as a PATTERN: the expression must be a
 * JSON object and every `"field": "<name>"` in it must name an allowed
 * field — a negative lookahead rejects any other name anywhere in the
 * tree. An out-of-set filter field would silently RAISE the per-row unit
 * cost above the authored constant, so it fails validation before any
 * spend. Filter syntax: https://docs.ahrefs.com/ (API → filter syntax).
 */
export function zWhere(fields: readonly string[]) {
    const allowed = fields.join("|");
    const pattern = new RegExp(
        `^(?![\\s\\S]*"field"\\s*:\\s*"(?!(?:${allowed})")[^"]*")\\s*\\{[\\s\\S]*\\}\\s*$`,
    );
    return z.string().regex(
        pattern,
        "where must be a JSON filter expression whose fields are all " +
            `from: ${fields.join(", ")}`,
    ).describe(
        "JSON filter expression (see the Ahrefs filter syntax docs), e.g. " +
            '{"field":"first_seen","is":["gte","2025-01-01"]}. Filterable ' +
            `fields: ${fields.join(", ")}.`,
    );
}
