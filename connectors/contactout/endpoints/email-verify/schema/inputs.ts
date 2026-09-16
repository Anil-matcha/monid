import { z } from "zod";
import { zEmail } from "../../../schema/common.ts";

/** GET /v1/email/verify query (ported from v1). */
export const zEmailVerifyQueryParams = z.object({
    email: zEmail.describe("The email address to verify."),
}).strict();
