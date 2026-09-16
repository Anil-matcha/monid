import { defineProvider, presets } from "@shared/core";

/**
 * Surf (asksurf.ai) — crypto intelligence for agents: 105 endpoints over
 * `https://api.asksurf.ai/gateway/v1`, Bearer auth. 104 are synchronous
 * relays (101 GET, three JSON POSTs in the on-chain SQL family); the one
 * durable SQL job (`/onchain/sql/jobs`) owns its own start / poll / stop
 * lifecycle at the endpoint (design D3).
 *
 * BILLING IS THE PUBLISHED TIER, NOT THE RESPONSE FIELD (design D1). Surf
 * prices every call at Light 1 / Standard 2 / Heavy 4 credits, and each
 * endpoint's flat PER_CALL line pins its tier. Every 2xx body also carries
 * `meta.credits_used` — v1 measured it against the account balance in
 * 2026-08 (13 endpoints, both directions wrong: `web/fetch` reports 2 and is
 * charged 1, `heatscore/projects` reports 1 and is charged 4, `onchain/sql`
 * reports 5 which is not a tier) — so it is NOT a vendor claim: no
 * `usage.consolidate`, the derived fold IS the bill, and the tests hold the
 * 105 tiers as literals (clay D7a). The field stays in the body, relayed
 * verbatim, with a provider note saying what it is not; v1 stripped it.
 *
 * Hooks here are the two provider-wide facts: bearer auth, and the error
 * digest over Surf's `{ error: { code, message } }` envelope (no `meta` on
 * errors, so nothing billing-related ever rides an error body).
 *
 * Timeouts mirror services/workflows/endpointExecution/config.yml (surf):
 * 60 s request / 60 s run; the SQL family's two docs override their own.
 */
export default defineProvider({
    name: "surf",
    meta: {
        displayName: "Surf",
        summary:
            "Crypto intelligence: market data, on-chain analytics, projects, news, prediction markets.",
        description: "Crypto intelligence for agents — token and exchange " +
            "market data, derivatives and liquidations, on-chain and " +
            "wallet analytics, project and VC fund research, crypto news, " +
            "prediction markets across Polymarket and Kalshi, Hyperliquid " +
            "trading analytics, project signal scores, and a read-only " +
            "ClickHouse SQL surface over 111 on-chain tables.",
        homepageUrl: "https://asksurf.ai",
        docsUrl: "https://docs.asksurf.ai",
        categories: ["token-prices", "onchain-data", "prediction-markets"],
        /** Provider-wide caveats (concatenated before each endpoint's). */
        notes: [
            "Every call is billed at its published tier (Light 1, Standard " +
            "2, or Heavy 4 Surf credits) regardless of response size or " +
            "batch size. The meta.credits_used field in responses is NOT " +
            "the amount charged (it over- and under-reports) and is " +
            "relayed as-is.",

            "Non-2xx responses are not charged. The documented 3-minute " +
            "cache (an identical call free) was refuted by measurement: " +
            "every call is charged.",

            "Rate limit: 100 requests per minute per key, shared across " +
            "all endpoints.",
        ],
    },
    auth: { inject: presets.auth.bearer() },
    // The version segment lives in the base URL: endpoint paths are the
    // unversioned vendor paths (`/market/price`), exactly as v1 authored
    // them. Surf's OpenAPI declares a relative `servers` entry, so the host
    // is a constant here, not derived.
    request: { baseUrl: "https://api.asksurf.ai/gateway/v1" },
    timeouts: { requestMs: 60_000, runMs: 60_000 },
    output: {
        // THE error-digestion hook (design D12): Surf's error envelope is
        // `{ error: { code, message } }` (observed INVALID_REQUEST 400,
        // UNAUTHORIZED 401, FREE_QUOTA_EXHAUSTED / PAID_BALANCE_ZERO 402);
        // unknown paths answer a bare-text 404, which has neither. Runs
        // only on provider-error envelopes, after zero-usage forcing. The
        // raw body rides under `raw` — digest, never hide.
        fromError: ({ data, utils }) => {
            const message = utils.json.optionalGet(
                data.output,
                "$.error.message",
            );
            const code = utils.json.optionalGet(data.output, "$.error.code");
            return {
                message: typeof message === "string"
                    ? message
                    : "Surf API error",
                ...(typeof code === "string" ? { code } : {}),
                raw: data.output,
            };
        },
    },
    usage: {
        /** THE credit system (design D26): Surf bills a prepaid credit
         *  balance and every endpoint draws whole credits from it — one
         *  pool ⇒ id `default`. The $/credit ($0.006 list, volume tiers
         *  down to $0.002) is the broker card's job, not the doc's. */
        credits: { default: { label: "Surf credits" } },
        // No consolidate (D1): the body's meter is not the charge. No
        // provider-level model / estimate / evidence: every doc is flat
        // PER_CALL, so the compiler synthesizes the lawful empty fns.
    },
});
