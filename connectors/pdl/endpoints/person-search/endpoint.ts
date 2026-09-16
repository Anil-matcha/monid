import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { z } from "zod";
import { zPdlPersonSearchVariants } from "./schema/inputs.ts";

const [zQueryVariant, zSqlVariant] = zPdlPersonSearchVariants;

/** POST /v5/person/search — Elasticsearch or SQL search, one credit per
 *  record returned. */
export default defineEndpoint({
    meta: {
        displayName: "Find People",
        summary: "Search the People Data Labs person dataset with " +
            "Elasticsearch or SQL queries.",
        description: "Search and filter the full People Data Labs person " +
            "dataset using Elasticsearch or SQL queries (provide one, not " +
            "both; Elasticsearch recommended). The query runs directly " +
            "against the Person Dataset without cleaning or preprocessing. " +
            "Build queries from any field in the Person Schema (name, job " +
            "title, company, location, skills, education, etc.); the " +
            "field descriptions in the Person Schema and the underlying " +
            "Elasticsearch Mapping are the reference for writing " +
            "effective queries. Returns " +
            "up to 100 matching person records per request with " +
            "scroll_token pagination; a valid query with no matches is a " +
            "200 with an empty data array. Charged per record retrieved.",
        docsUrl:
            "https://docs.peopledatalabs.com/docs/reference-person-search-api",
        categories: ["people-enrichment"],
    },
    request: { method: "POST", path: "/v5/person/search" },
    // `size` REQUIRED at the binding on BOTH variants (design D25 — the
    // mirror stays the faithful vendor contract, optional with vendor
    // default 1): it is the estimate's whole basis, so the caller states
    // it. The 1-100 bounds are the vendor's own.
    input: {
        schema: {
            body: z.union([
                zQueryVariant.required({ size: true }),
                zSqlVariant.required({ size: true }),
            ]),
        },
    },
    usage: {
        /** "Each person record in the data array of the response counts
         *  as a single credit" (PDL docs) — v1 makePerResultPrice(0.265),
         *  from the `people_search` pool (PDL's `x-call-credits-type:
         *  search`), declared on the provider. Settle is inherited: the
         *  provider evidence counts `data[]`. */
        model: {
            kind: UsageModelKind.PER_UNIT,
            unit: Unit.RESULT,
            label: "records",
            consumes: { credit: "people_search", amount: 1 },
        },
        /** The caller-stated size IS the record promise (typed read of the
         *  pre-toRequest validated input — design D25). */
        estimate: ({ data }) => ({
            counts: { "RESULT": data.input.body.size },
        }),
    },
});
