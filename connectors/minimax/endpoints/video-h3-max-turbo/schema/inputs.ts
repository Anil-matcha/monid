import { makeH3VideoBody } from "../../../schema/h3-video.ts";

/**
 * MiniMax-H3-Max-Turbo request body. The fastest, cheapest tier: 480P and
 * 768P, clips from 5 seconds, text-to-video and image-to-video ONLY —
 * reference images, video and audio are not supported, so those roles are
 * absent from the content union entirely.
 */
export const zH3MaxTurboVideoBody = makeH3VideoBody({
    modelId: "MiniMax-H3-Max-Turbo",
    resolutions: ["480P", "768P"],
    minDuration: 5,
    supportsReference: false,
});
