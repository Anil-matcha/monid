import { z } from "zod";
import { peopleSearchFilterShape } from "../../../schema/people-search.ts";

/** POST /v1/people/count body (ported from v1): the people-search filter
 *  set verbatim — upstream documents count as "the same parameters except
 *  page, data_types, and reveal_info". */
export const zPeopleCountBody = z.object(peopleSearchFilterShape).strict();
