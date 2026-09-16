import { z } from "zod";
import { zModel, zOutputs, zParams } from "../../../schema/common.ts";

/**
 * `POST /v1/generations/text-to-3d` request body — the faithful vendor
 * mirror (design D25): optionality only, no `.default()`.
 */
export const zTextTo3dBody = z.object({
    model: zModel.optional(),
    prompt: z.string().min(1).max(4000)
        .describe("Describe the mesh you want. 1–4000 characters.")
        .meta({
            examples: [
                "a low-poly forest dragon, game-ready, mossy bark texture",
            ],
        }),
    params: zParams.optional(),
    outputs: zOutputs.optional(),
});
