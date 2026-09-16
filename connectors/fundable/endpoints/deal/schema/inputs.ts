import { z } from "zod";
import { zDealId } from "../../../schema/common.ts";

/** GET /deals/{id} path params. */
export const zDealPathParams = z.object({ id: zDealId }).strict();
