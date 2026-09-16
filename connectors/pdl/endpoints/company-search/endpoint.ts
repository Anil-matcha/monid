import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { z } from "zod";
import { zPdlCompanySearchVariants } from "./schema/inputs.ts";

const [zQueryVariant, zSqlVariant] = zPdlCompanySearchVariants;

/** POST /v5/company/search — Elasticsearch or SQL search, one credit per
 *  record returned. */
export default defineEndpoint({
    meta: {
        displayName: "Find Companies",
        summary: "Search the People Data Labs company dataset with " +
            "Elasticsearch or SQL queries.",
        description: "Search and filter the full People Data Labs company " +
            "dataset using Elasticsearch or SQL queries (provide one, not " +
            "both; Elasticsearch recommended). The query runs directly " +
            "against the Company Dataset without cleaning or " +
            "preprocessing. Build queries from any field in the Company " +
            "Schema (name, industry, size, location, funding, tech stack, " +
            "etc.); the field descriptions in the Company Schema and the " +
            "underlying Elasticsearch Mapping are the reference for " +
            "writing effective queries. Returns up to 100 matching " +
            "company records per request " +
            "with scroll_token pagination; a valid query with no matches " +
            "is a 200 with an empty data array. Charged per record " +
            "retrieved.",
        docsUrl:
            "https://docs.peopledatalabs.com/docs/reference-company-search-api",
        categories: ["company-enrichment"],
    },
    request: { method: "POST", path: "/v5/company/search" },
    // `size` REQUIRED at the binding on BOTH variants (design D25; see
    // endpoints/person-search/endpoint.ts).
    input: {
        schema: {
            body: z.union([
                zQueryVariant.required({ size: true }),
                zSqlVariant.required({ size: true }),
            ]),
        },
    },
    usage: {
        /** One credit per company record in `data[]` (PDL docs) — v1
         *  makePerResultPrice(0.1), from the `company_search` pool (PDL's
         *  `x-call-credits-type: search_company`), declared on the
         *  provider. Settle is inherited. */
        model: {
            kind: UsageModelKind.PER_UNIT,
            unit: Unit.RESULT,
            label: "records",
            consumes: { credit: "company_search", amount: 1 },
        },
        estimate: ({ data }) => ({
            counts: { "RESULT": data.input.body.size },
        }),
    },
});
