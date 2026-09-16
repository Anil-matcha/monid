import { defineProvider } from "@shared/core";
import { zContactoutCredentials } from "./schema/auth.ts";

/**
 * ContactOut (contactout.com) — LinkedIn-native contact data, ported from
 * monid-services `adaptors/contactout`. Twenty synchronous JSON endpoints
 * on one host (`https://api.contactout.com`), authenticated by a bare
 * `token` header.
 *
 * TWO API KEYS (design D1). Monid holds a WORK-email key and a
 * PERSONAL-email key — two accounts, each with its own email / phone /
 * search credit pools and its own email rate; a key returns only its
 * email kind. So the six email-bearing operations ship as work/personal
 * PAIRS (same wire path, ids suffixed `/work-email` / `/personal-email`),
 * and the credential is ONE object holding both keys, declared here.
 * WHICH key rides the header is each endpoint's own `auth.inject` (owner
 * call 2026-09-16): thirteen send `workApiKey`, seven `personalApiKey`.
 * Neither preset fits — `presets.auth.header` reads `data.params.apiKey`,
 * and the two shapes deliberately name their keys — so both injects are
 * spelled inline (the opoint posture).
 *
 * BILLING (design D2). ContactOut responses carry NO usage meter; the
 * vendor's draw is only visible as `/v1/stats` pool diffs. So there is no
 * `usage.consolidate`, and every charging endpoint COUNTS its own units
 * from the response (`usage.evidence`): 1 email credit of the key's kind
 * per profile with an address, 1 phone credit per profile with a number,
 * 1 search credit per profile returned by a search, or per profile that
 * matched WITHOUT billable contacts (the either/or the vendor applies to
 * `/v1/linkedin/enrich`). Misses are free everywhere — a 200 with
 * `profile: []`, or a 404 the engine zero-bills as error-as-data. The
 * derived fold IS the bill, and — eyes open — no `usage.mismatch.derived`
 * cross-check exists for ContactOut; the tests pin the rates as literals
 * (clay's D7a posture).
 *
 * Nothing to strip: the bodies carry no billing field (v1 stamped its
 * unit counters ONTO the output; v2 publishes them as `usage.evidence`
 * instead), so no `output.fromResponse` either.
 */
export default defineProvider({
    name: "contactout",
    meta: {
        displayName: "ContactOut",
        summary:
            "LinkedIn-native contact data: emails, phones, people and company search.",
        description: "ContactOut — LinkedIn-native contact data for agents: " +
            "resolve any LinkedIn profile into work or personal emails and " +
            "phone numbers, enrich people from an email or partial " +
            "identifiers, search 300M+ profiles by title, company, and " +
            "skills, list a company's decision makers with contact " +
            "reveal, enrich companies from domains, and verify email " +
            "deliverability. Email-bearing operations come in two " +
            "variants — work email and personal email — because " +
            "ContactOut issues one key per email kind and prices them " +
            "differently; pick the variant for the address kind you need.",
        homepageUrl: "https://contactout.com",
        docsUrl: "https://api.contactout.com/",
        categories: ["people-enrichment", "company-enrichment"],
        notes: [
            "Every lookup re-bills — ContactOut does not dedupe repeat " +
            "queries for the same profile.",
            "Credits are drawn per PROFILE, not per address: a profile " +
            "returning two emails (or two phone numbers) consumes one " +
            "email (or phone) credit.",
            "Misses are free: a profile ContactOut does not know answers " +
            "200 with an empty profile or 404, and neither draws a credit.",
        ],
    },
    auth: {
        /** Both keys, one credential (design D1). No provider inject: the
         *  paired endpoints share a wire path, so each endpoint states
         *  which key it sends. */
        credentials: zContactoutCredentials,
    },
    request: {
        baseUrl: "https://api.contactout.com",
        headers: { Accept: "application/json" },
    },
    // mirrors services/workflows/endpointExecution/config.yml (contactout):
    // request 60s, run 120s; no pollMs — every endpoint is sync.
    timeouts: { requestMs: 60_000, runMs: 120_000 },
    usage: {
        /** THE credit systems (design D2): three prepaid pools PER KEY
         *  (`/v1/stats`: `remaining` / `phone_remaining` /
         *  `search_remaining`, key-scoped — each key is its own account),
         *  plus the verifier pool, a free bundle both keys draw from that
         *  `/v1/stats` does not expose. Declared once here; each compiled
         *  doc narrows to the pools its own lines drain (pdl D6). The
         *  contract $/credit rates (v1 CONTACTOUT_COST_RATES: work email
         *  0.07, personal email 0.17, phone 0.16, search 0.018, verifier
         *  0) are the broker card's job, not the doc's. */
        credits: {
            email_work: { label: "work-key email credits" },
            phone_work: { label: "work-key phone credits" },
            search_work: { label: "work-key search credits" },
            email_personal: { label: "personal-key email credits" },
            phone_personal: { label: "personal-key phone credits" },
            search_personal: { label: "personal-key search credits" },
            verifier: {
                label: "email verifier credits",
                description:
                    "a free bundle of 20,000 credits per key; drawn only on " +
                    "a definitive verdict (valid / invalid / accept_all)",
            },
        },
        // No `consolidate`: no ContactOut response reports a consumed
        // amount (design D2). No provider-level model/estimate/evidence:
        // the counting basis differs per endpoint family.
    },
    output: {
        /** THE error-digestion hook: ContactOut's non-2xx envelope is a
         *  flat `{status_code, message}` (real behaviour, drill-verified
         *  2026-08-24: 401 bad token, 400 bad input, 404 miss, 403 out of
         *  credits, 429 + retry-after — the documented table is swapped).
         *  Runs only on provider errors, after zero-usage forcing; the
         *  raw body rides under `raw` — digest, never hide. */
        fromError: ({ data, utils }) => {
            const message = utils.json.optionalGet(data.output, "$.message");
            const code = utils.json.optionalNum(data.output, "$.status_code");
            return {
                message: typeof message === "string" && message !== ""
                    ? message
                    : "ContactOut API error",
                ...(code !== undefined ? { code } : {}),
                raw: data.output,
            };
        },
    },
});
