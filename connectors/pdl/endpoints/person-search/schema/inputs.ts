import { z } from "zod";
import {
    searchSharedFields,
    zEsQuery,
    zSqlQuery,
} from "../../../schema/common.ts";

const personSearchShared = {
    ...searchSharedFields,
    // A STRING, not an enum (PR #7 review): PDL's `dataset` is a
    // comma-separated LIST with an exclusion form ("all,-phone" —
    // `-` entered once, excluding every name after it), so v1's
    // `z.enum(PERSON_DATASETS)` rejected valid vendor requests. The
    // mirror is faithful to the vendor's grammar (design D25); the
    // names live in the describe, where they document without gating.
    dataset: z.string().min(1).optional().describe(
        "Dataset(s) to search, comma-separated — all, resume, email, " +
            "phone, mobile_phone, street_address, consumer_social, " +
            "developer. Use `-` once to exclude every name after it " +
            "(e.g. 'all,-phone,consumer_social'). Default resume.",
    ),
    data_include: z.string().optional().describe(
        "Comma-separated fields to include in each returned record.",
    ),
};

/** POST /v5/person/search body — Elasticsearch `query` XOR `sql`, each a
 *  strict variant so a body carrying both fails validation (the ONE v1
 *  cross-field rule that survives compilation — design D6). */
export const zPdlPersonSearchBody = z.union([
    z.object({ query: zEsQuery, ...personSearchShared }).strict(),
    z.object({ sql: zSqlQuery, ...personSearchShared }).strict(),
]);

/** The two variants, exposed so the binding can tighten `size` on each. */
export const zPdlPersonSearchVariants = zPdlPersonSearchBody.options;
