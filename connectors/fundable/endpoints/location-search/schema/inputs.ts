import { z } from "zod";

/** GET /location/search query params. Upstream also accepts a
 *  `location_type` alias for `type`; only `type` is exposed (both at once
 *  is a 400). */
export const zLocationSearchQueryParams = z.object({
    name: z.string().min(1).describe("Location name; fuzzy matched."),
    type: z.enum(["CITY", "STATE", "REGION", "COUNTRY"]).optional().describe(
        "Restrict to one location level.",
    ),
}).strict();
