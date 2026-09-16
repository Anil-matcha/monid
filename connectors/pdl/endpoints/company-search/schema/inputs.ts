import { z } from "zod";
import {
    searchSharedFields,
    zEsQuery,
    zSqlQuery,
} from "../../../schema/common.ts";

/** POST /v5/company/search body — Elasticsearch `query` XOR `sql` (strict
 *  variants, design D6). Company search has no dataset / data_include. */
export const zPdlCompanySearchBody = z.union([
    z.object({ query: zEsQuery, ...searchSharedFields }).strict(),
    z.object({ sql: zSqlQuery, ...searchSharedFields }).strict(),
]);

/** The two variants, exposed so the binding can tighten `size` on each. */
export const zPdlCompanySearchVariants = zPdlCompanySearchBody.options;
