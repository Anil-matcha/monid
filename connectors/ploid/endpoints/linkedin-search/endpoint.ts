import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zPloidLinkedinSearchBody } from "./schema/inputs.ts";

/** `POST /v1/linkedin/search` — bills like `/v1/search`: one block per
 *  started 10 `data.items`. */
export default defineEndpoint({
    meta: {
        displayName: "Search Professionals",
        summary:
            "Search LinkedIn people by keywords, location, title, company, and school.",
        description: "Structured LinkedIn people search. Returns up to 100 " +
            "matches per page with socialId, public identifier, profile " +
            "URL, full name, headline, location, industry, picture URL, " +
            "and connection degree, plus a cursor for the next page and " +
            "the total when known. Each filter (keywords, location, title, " +
            "currentCompany, school) accepts one value or a list. Suited " +
            "for building candidate and prospect lists scoped to a " +
            "company, school, or geography. Pass a result's profileUrl to " +
            "/v1/linkedin/profile for the complete history.",
        docsUrl: "https://ploid.com/documentation/api/social",
        categories: ["linkedin"],
    },
    request: { method: "POST", path: "/v1/linkedin/search" },
    // `limit` REQUIRED at the binding (design D25): the estimate's basis.
    input: {
        schema: { body: zPloidLinkedinSearchBody.required({ limit: true }) },
    },
    usage: {
        /** One block per STARTED 10 returned matches at 0.1 ACU — same
         *  card as /v1/search (drill 2026-09-05: 15 items metered 0.2). */
        model: {
            kind: UsageModelKind.PER_UNIT,
            unit: Unit.RESULT,
            label: "matches",
            every: 10,
            consumes: { credit: "default", amount: 0.1 },
            description: "returned matches, billed per started block of 10",
        },
        estimate: ({ data }) => ({
            counts: { "RESULT": data.input.body.limit },
        }),
        /** Settle counts DELIVERED rows in `data.items[]` (v1
         *  countSearchItems; 0 when absent). */
        evidence: ({ data, utils }) => ({
            counts: {
                "RESULT": utils.json.optionalLen(data.output, "$.data.items") ??
                    0,
            },
        }),
    },
});
