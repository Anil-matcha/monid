import { makeH3VideoBody } from "../../../schema/h3-video.ts";

/**
 * MiniMax-H3 (Standard H3) request body. The family's top tier: 480P,
 * 768P and 2K, clips from 4 seconds, and the full reference-to-video
 * surface (reference images, video and audio).
 */
export const zH3VideoBody = makeH3VideoBody({
    modelId: "MiniMax-H3",
    resolutions: ["480P", "768P", "2K"],
    minDuration: 4,
    supportsReference: true,
});
