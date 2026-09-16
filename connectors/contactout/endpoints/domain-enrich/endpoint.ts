import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zDomainEnrichBody } from "./schema/inputs.ts";

/**
 * POST /v1/domain/enrich — full company records for up to 30 domains.
 *
 * One search credit per company FOUND (v1 makePerResultPrice(search)).
 * No email data flows, so it rides the work key (search credits price the
 * same on either account). The response shape DISAGREES with company
 * search (local E2E 2026-08-25): this endpoint answers `companies` as an
 * OBJECT keyed by domain, the docs show an array — counting only the array
 * under-billed v1 to $0, so both shapes are read.
 */
export default defineEndpoint({
    meta: {
        displayName: "Enrich Company Domains",
        summary:
            "Full company profiles for up to 30 website domains in one call; bills search credits.",
        description: "Domains in, company records out. Returns per company " +
            "the name, LinkedIn vanity URL, description, website, logo, " +
            "type, headquarters, country, size, founding year, locations, " +
            "industry, specialties, technologies in use, revenue, employee " +
            "and follower counts, and a funding summary (total raised, " +
            "rounds with investors, status, latest date). Domains without " +
            "a match are simply absent and cost nothing. Suited for " +
            "account qualification and firmographic enrichment of domain " +
            "lists. Chain onward: pass a domain to Find Decision Makers to " +
            "list its key people.",
        docsUrl: "https://api.contactout.com/#company-information-from-domains",
        categories: ["company-enrichment"],
        notes: [
            "One search credit per company FOUND — unmatched domains are " +
            "free.",
        ],
    },
    request: { method: "POST", path: "/v1/domain/enrich" },
    /** Sends the WORK key (design D1): the provider holds both keys, the
     *  endpoint says which one rides the `token` header. */
    auth: {
        inject: ({ data }) => ({
            ...data.request,
            headers: { ...data.request.headers, token: data.params.workApiKey },
        }),
    },
    input: { schema: { body: zDomainEnrichBody } },
    usage: {
        model: {
            kind: UsageModelKind.PER_UNIT,
            unit: Unit.RESULT,
            label: "companies found",
            description: "company records returned, one per matched domain",
            consumes: { credit: "search_work", amount: 1 },
        },
        /** Every domain may match — the request length is the promise. */
        estimate: ({ data }) => ({
            counts: { "RESULT": data.input.body.domains.length },
        }),
        /** v1 `companiesCount`: array length OR object key count. */
        evidence: ({ data, utils }) => {
            const companies = utils.json.optionalGet(
                data.output,
                "$.companies",
            );
            const found = Array.isArray(companies)
                ? companies.length
                : companies !== undefined && companies !== null &&
                        typeof companies === "object"
                ? Object.keys(companies).length
                : 0;
            return { counts: { "RESULT": found } };
        },
    },
});
