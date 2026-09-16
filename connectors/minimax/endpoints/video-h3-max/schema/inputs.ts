import { makeH3VideoBody } from "../../../schema/h3-video.ts";

/**
 * MiniMax-H3-Max request body. The high-speed tier: 480P and 768P (no 2K),
 * clips from 5 seconds, with the reference-to-video surface.
 *
 * NOTE (design D8): MiniMax's public pricing page currently describes
 * H3-Max as "T2V and I2V only". v1 models it with reference support and
 * split input-video rates, confirmed directly with MiniMax, so the
 * reference roles stay in the schema. Task 5.2 verifies this against a
 * real call once a key exists.
 */
export const zH3MaxVideoBody = makeH3VideoBody({
    modelId: "MiniMax-H3-Max",
    resolutions: ["480P", "768P"],
    minDuration: 5,
    supportsReference: true,
});
