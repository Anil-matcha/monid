import { z } from "zod";
import { zEmail } from "../../../schema/common.ts";

/** GET /v1/people/person query (ported from v1). */
export const zEmailToLinkedinQueryParams = z.object({
    email: zEmail.describe("The email address to resolve."),
}).strict();
