import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zEmailVerifyQueryParams } from "./schema/inputs.ts";

/**
 * GET /v1/email/verify — deliverability verdict for one address.
 *
 * One verifier credit per DEFINITIVE verdict (valid / invalid /
 * accept_all); unknown and disposable are free. Documented-only: the
 * verifier pool is invisible in `/v1/stats` under either key, so unlike the
 * other pools this rule could not be diff-verified (vendor question open).
 * Work key.
 */
export default defineEndpoint({
    meta: {
        displayName: "Verify Email",
        summary:
            "Check one email address's deliverability; a definitive verdict bills one verifier credit.",
        description: "One email address in, its deliverability verdict out: " +
            "valid, invalid, accept_all (the server accepts any address), " +
            "disposable, or unknown. Only definitive verdicts " +
            "(valid/invalid/accept_all) bill a unit — disposable and " +
            "unknown results are free. Suited for pre-send list cleaning " +
            "and validating addresses found through search or enrichment.",
        docsUrl: "https://api.contactout.com/#email-verifier-api",
        categories: ["people-enrichment"],
        notes: [
            "Charged only on a definitive verdict — disposable and unknown " +
            "results are free.",
        ],
    },
    request: { method: "GET", path: "/v1/email/verify" },
    /** Sends the WORK key (design D1): the provider holds both keys, the
     *  endpoint says which one rides the `token` header. */
    auth: {
        inject: ({ data }) => ({
            ...data.request,
            headers: { ...data.request.headers, token: data.params.workApiKey },
        }),
    },
    input: { schema: { queryParams: zEmailVerifyQueryParams } },
    usage: {
        model: {
            kind: UsageModelKind.PER_UNIT,
            unit: Unit.RESULT,
            label: "definitive verdicts",
            description: "verdicts of valid, invalid or accept_all",
            consumes: { credit: "verifier", amount: 1 },
        },
        /** One address, one possible verdict. */
        estimate: () => ({ counts: { "RESULT": 1 } }),
        /** v1 `verifyActuals`: `data.status` in the billed set. */
        evidence: ({ data, utils }) => {
            const status = utils.json.optionalGet(data.output, "$.data.status");
            const billed = status === "valid" || status === "invalid" ||
                status === "accept_all";
            return { counts: { "RESULT": billed ? 1 : 0 } };
        },
    },
});
