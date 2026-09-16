import { z } from "zod";
import {
    zCountry,
    zDate,
    zMode,
    zProtocol,
    zTarget,
} from "../../../../schema/common.ts";

/** The fixed `select` list — 120 API units per row (design D4). */
export const AI_RESPONSES_COUNT_FIELDS = [
    "chatgpt",
    "copilot",
    "gemini",
    "google_ai_mode",
    "google_ai_overviews",
    "google_ai_overviews_keywords",
    "grok",
    "perplexity",
] as const;

/** GET /site-explorer/ai-responses-count query (ported from v1). */
export const zAiResponsesCountQueryParams = z.object({
    target: zTarget,
    date: zDate.optional(),
    country: zCountry.optional(),
    mode: zMode.optional(),
    protocol: zProtocol.optional(),
}).strict();
