import { z } from "zod";
import { zDealId } from "../../../schema/common.ts";

/** GET /deals/{id}/investors path params. */
export const zDealPathParams = z.object({ id: zDealId }).strict();
