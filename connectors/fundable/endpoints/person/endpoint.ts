import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zPersonQueryParams } from "./schema/inputs.ts";

/** GET /person — one person by identifier, flat per call. */
export default defineEndpoint({
    meta: {
        displayName: "Get Person Profile",
        summary: "Get person details by identifier.",
        description: "Fetch one person by UUID, LinkedIn URL, Crunchbase " +
            "URL, or Twitter URL (exactly one). Returns name, title, " +
            "profile URLs, location, about, is_founder, current_company, " +
            "the FULL employment_history and education_history, " +
            "is_investor, is_angel, has_led_deal, investment_firms with " +
            "per-firm deal counts, and investor_highlights (total and lead " +
            "deal counts, last-12-month activity, top industries, " +
            "locations, round types). Resolve a name into an id with " +
            "/person/search first. Suited for profiling a founder or " +
            "investor before outreach.",
        docsUrl: "https://docs.tryfundable.ai/api-reference/people/get",
        categories: ["funding-data", "people-enrichment"],
    },
    request: { method: "GET", path: "/person" },
    input: { schema: { queryParams: zPersonQueryParams } },
    usage: {
        /** 1 credit per call — v1 drill (2026-09-01). */
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "lookup",
            consumes: { credit: "default", amount: 1 },
        },
    },
});
