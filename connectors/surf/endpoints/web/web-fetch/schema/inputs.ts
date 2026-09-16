import { z } from "zod";

/** GET /web/fetch query params (ported from v1; faithful vendor mirror,
 *  optionality only — vendor defaults are applied at the binding). */
export const zWebFetchQueryParams = z.object({
    url: z.url().describe(
        "URL to fetch and parse. Example: https://ethereum.org.",
    ),
    target_selector: z.string().min(1).describe(
        "CSS selector to extract specific content. Example: " +
            "article.main-content.",
    ).optional(),
    remove_selector: z.string().min(1).describe(
        "CSS selector to remove unwanted elements. Example: nav,footer,.ads.",
    ).optional(),
    wait_for_selector: z.string().min(1).describe(
        "CSS selector to wait for before extracting. Example: .content-loaded.",
    ).optional(),
    timeout: z.number().int().min(1000).max(60000).describe(
        "Request timeout in milliseconds. Example: 5000. Defaults to 30000.",
    ).optional(),
}).strict();
