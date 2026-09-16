import { defineProvider, presets } from "@shared/core";

/**
 * Ploid (ploid.com) — people intelligence: a plain-English people search,
 * social and LinkedIn-anchored enrichment, six public LinkedIn reads, and
 * a model-led research agent. One host (`https://api.ploid.com`, paths
 * carry `/v1`), one key (`Authorization: Bearer`), one `{data, meta}`
 * envelope on every response.
 *
 * Billing: Ploid's single denomination is the ACU (1 ACU = USD 0.10,
 * `acu_value_usd` const). Two meter fields report it — `meta.credits_charged`
 * (search / socials / LinkedIn; ACU despite the legacy name) and
 * `meta.acu_used` (agent / enrich) — so ONE provider consolidate reads
 * whichever a response carries. v1 converted every ACU figure to dollars;
 * the pool rule (2026-09-15) keeps the vendor's unit. Nine docs are
 * declarative; `/agent` alone is async and owns its lifecycle (D1).
 */
export default defineProvider({
    name: "ploid",
    meta: {
        displayName: "Ploid",
        summary:
            "People intelligence: live people search, enrichment, LinkedIn reads, research agent.",
        description: "Ploid — people intelligence for agents: search a " +
            "continuously refreshed index of professional profiles in " +
            "plain English, enrich a person's profile, email, and phone " +
            "from a LinkedIn URL, read public LinkedIn profiles, posts, and " +
            "company pages without cookies or proxies, and run a model-led " +
            "research agent with a hard compute ceiling.",
        homepageUrl: "https://ploid.com",
        docsUrl: "https://ploid.com/documentation/api",
        categories: ["people-enrichment", "linkedin"],
    },
    auth: { inject: presets.auth.bearer() },
    request: { baseUrl: "https://api.ploid.com" },
    // mirrors services/workflows/endpointExecution/config.yml (ploid):
    // request 60s, run 60s; /agent overrides run 600s + poll 5s
    timeouts: { requestMs: 60_000, runMs: 60_000 },
    usage: {
        /** THE credit system (design D26): Ploid's native meter is the
         *  ACU — one pool for every doc; each doc's model states its
         *  draw in ACU (v1 `PLOID_USD_PER_ACU` × these figures). */
        credits: { default: { label: "Ploid ACU" } },
        /** The vendor's OWN claim (design D27): the ACU meter rides
         *  `meta.credits_charged` or `meta.acu_used` depending on the
         *  product — both plucked, the one present wins, entry OMITTED
         *  when neither is a number (never `?? 0`). The same motion
         *  strips the rest of v1's `META_INTERNAL_KEYS`: balances and
         *  tracing ids, and `session_id` — the shared-workspace agent
         *  handle that must never reach a buyer (all tenants share one
         *  Ploid workspace). `meta.warning` (partial results on
         *  search_timeout), `cursor` and `message` stay; an emptied
         *  `meta` is dropped, as v1 did. v1 lineage: providerFormatOutput
         *  (stripMetaInternals) + readCreditsCharged / readAcuUsed. */
        consolidate: ({ data, utils }) => {
            const charged = utils.json.pluck(
                data.output,
                "$.meta.credits_charged",
            );
            const used = utils.json.pluck(charged.rest, "$.meta.acu_used");
            const meter = typeof used.value === "number"
                ? used.value
                : charged.value;
            const stripped = utils.json.omit(used.rest, [
                "request_id",
                "session_id",
                "remaining_credits",
                "acu_remaining",
                "acu_value_usd",
                "acu_limit",
                "max_output_tokens",
            ]);
            const meta = utils.json.optionalGet(stripped, "$.meta");
            const emptied = typeof meta === "object" && meta !== null &&
                !Array.isArray(meta) && Object.keys(meta).length === 0;
            return {
                credits: {
                    ...(typeof meter === "number" ? { default: meter } : {}),
                },
                output: emptied
                    ? utils.json.pluck(stripped, "$.meta").rest
                    : stripped,
            };
        },
    },
});
