import { z } from "zod";

/** GET /search/web query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zSearchWebQueryParams = z.object({
    q: z.string().min(2).max(100).describe(
        "Search query like bitcoin price prediction 2026. Example: " +
            "bitcoin price prediction 2026.",
    ),
    limit: z.number().int().min(1).max(100).describe(
        "Results per page. Example: 20. Defaults to 20.",
    ).optional(),
    offset: z.number().int().min(0).describe(
        "Pagination offset. Example: 0. Defaults to 0.",
    ).optional(),
    site: z.string().min(1).describe(
        "Comma-separated domain filter like coindesk.com or " +
            "cointelegraph.com. Example: coindesk.com,cointelegraph.com.",
    ).optional(),
    include_content: z.boolean().describe(
        "When false (default), search returns title/url/description " +
            "only — fast (~2-3s) URL discovery. Set true to also include " +
            "full markdown content for each result (~5-30KB per result, " +
            "~10-15s for limit=5). Use true only when the caller needs " +
            "page content inline and won't follow up with /web/fetch. " +
            "Example: False. Defaults to false.",
    ).optional(),
}).strict();
