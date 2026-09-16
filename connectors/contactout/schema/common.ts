import { z } from "zod";

/**
 * Shared zod fragments for the ContactOut endpoint schemas (ported from v1
 * `adaptors/contactout/endpoints/common.ts`). Faithful vendor mirror:
 * optionality only, no `.default()` — every tightening lives at the
 * endpoint binding (design D25).
 */

/**
 * A regular LinkedIn profile URL. Upstream requires `http(s)` + a
 * `linkedin.com/in/` or `linkedin.com/pub/` path and rejects Sales
 * Navigator / Recruiter URLs. A single-field rule, so it compiles to a
 * JSON Schema `pattern` and is enforced before the wire.
 */
export const zLinkedInProfileUrl = z.string().regex(
    /^https?:\/\/.*linkedin\.com\/(in|pub)\//,
    "Must be a LinkedIn profile URL (linkedin.com/in/... or " +
        "linkedin.com/pub/...); Sales Navigator and Recruiter URLs are " +
        "not accepted.",
).describe(
    "The fully formed LinkedIn profile URL, e.g. " +
        "'https://www.linkedin.com/in/example-person'.",
);

/** An email address (compiles to `format: email` + pattern). */
export const zEmail = z.email();

/** Employer headcount buckets, ContactOut's own vocabulary. */
export const zCompanySize = z.enum([
    "1_10",
    "11_50",
    "51_200",
    "201_500",
    "501_1000",
    "1001_5000",
    "5001_10000",
    "10001",
]);

/**
 * Query shape of the three free Contact Checkers and the contacts-only
 * lookups: one LinkedIn profile URL.
 */
export const zProfileQueryParams = z.object({
    profile: zLinkedInProfileUrl,
}).strict();
