import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPdlPersonEnrichQueryParams } from "./schema/inputs.ts";

/** GET /v5/person/enrich — one-to-one person match, one credit per match. */
export default defineEndpoint({
    meta: {
        displayName: "Enrich Person",
        summary: "Enrich a person record from identifiers (email, phone, " +
            "name+company, LinkedIn, or PDL ID).",
        description: "Enrich data on a person by matching against ~3 " +
            "billion profiles in the People Data Labs dataset. Input " +
            "identifiers like email, phone, name+company, LinkedIn URL, or " +
            "PDL ID. Returns a comprehensive person record with employment " +
            "history, education, skills, social profiles, contact " +
            "information, and more. One-to-one match with a confidence " +
            "likelihood score (1-10); no match is a 404 and costs nothing.",
        docsUrl:
            "https://docs.peopledatalabs.com/docs/reference-person-enrichment-api",
        categories: ["people-enrichment"],
    },
    // The SDK's own wire form (14.1.1): GET, every parameter on the query
    // string. v1 declared POST + body because its relay only forwarded a
    // body on non-GET and the SDK did the real transport.
    request: { method: "GET", path: "/v5/person/enrich" },
    input: { schema: { queryParams: zPdlPersonEnrichQueryParams } },
    usage: {
        /** "We charge per match" — one credit per 200 (v1
         *  makePerCallPrice(0.265) = one person record) from the
         *  `people_enrich` pool (PDL's `x-call-credits-type: enrich`),
         *  declared on the provider.
         *  Estimate and evidence are compiler-synthesized (flat model). */
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "match",
            consumes: { credit: "people_enrich", amount: 1 },
        },
    },
});
