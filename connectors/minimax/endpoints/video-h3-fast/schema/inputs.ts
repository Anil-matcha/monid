import { makeH3VideoBody } from "../../../schema/h3-video.ts";

/**
 * MiniMax-H3-Fast request body. The budget tier: 480P only, clips from 5
 * seconds, with the full reference-to-video surface kept.
 *
 * `style` is NOT exposed. The upstream V2 call requires it for this model,
 * and MiniMax describes `style1`/`style2` as interchangeable internal
 * terms with no caller-facing meaning, so the endpoint injects `style1` at
 * the wire instead of asking the caller to pick a value that does nothing.
 */
export const zH3FastVideoBody = makeH3VideoBody({
    modelId: "MiniMax-H3-Fast",
    resolutions: ["480P"],
    minDuration: 5,
    supportsReference: true,
});
