import { defineProvider, presets } from "@shared/core";

/**
 * Fundable (tryfundable.ai) — real-time startup funding data. Every
 * endpoint is ONE synchronous JSON-over-HTTP call against
 * `https://www.tryfundable.ai/api/v1` (the `/api/v1` path prefix survives
 * url resolution — design D5 of add-connectors-tinyfish-akta-octen), auth
 * `Authorization: Bearer <key>`, so both settle fns live HERE and all
 * seventeen endpoints inherit them (leaf-wise fallback):
 *
 *   - `usage.consolidate`: Fundable's NATIVE meter is CREDITS — every
 *     response reports its own draw in `meta.credits_used` (1 per row or
 *     lookup, 0.1 per fuzzy search, 0 on the resolvers — v1 drill,
 *     2026-09-01). The claim is plucked out of the payload in one motion
 *     (design D27); the three account-level fields that ride `meta` on
 *     non-API-tier keys (`credit_source`, `*_remaining`) are stripped
 *     beside it — billing facts never reach the user-facing output. v1
 *     lineage: providerFormatOutput (stripCreditMeta) + providerGetActualCost
 *     (extractCreditsUsed), one fn.
 *   - `usage.evidence`: the generic quantities default — a row-billed doc
 *     counts the ONE collection array under `data` (`deals`, `companies`,
 *     `investors`, `people`), flat and FREE docs count nothing. v1
 *     lineage: extractResultCount.
 *
 * The partner invoices in dollars from a contract price sheet, not from
 * the credit count; that conversion is the broker card's job, never the
 * doc's (owner rule 2026-09-15: pools are the vendor's own credits).
 */
export default defineProvider({
    name: "fundable",
    meta: {
        displayName: "Fundable",
        summary: "Real-time startup funding data: rounds, companies, " +
            "investors, and people.",
        description: "Real-time startup funding data for agents — venture " +
            "funding rounds within hours of announcement, funded " +
            "companies with latest-round and valuation details, investor " +
            "firms with portfolio statistics, lead partners and angels on " +
            "every deal, founders and executives with employment history, " +
            "and source articles; filter by stage, size, date, industry, " +
            "location, and investor, or by semantic description.",
        homepageUrl: "https://www.tryfundable.ai",
        docsUrl: "https://docs.tryfundable.ai",
        categories: ["funding-data"],
    },
    auth: { inject: presets.auth.bearer() },
    request: { baseUrl: "https://www.tryfundable.ai/api/v1" },
    // mirrors services/workflows/endpointExecution/config.yml (fundable):
    // request 60s, run 60s — sync provider, no poll loop
    timeouts: { requestMs: 60_000, runMs: 60_000 },
    usage: {
        /** THE credit system (design D26) — Fundable's own meter, declared
         *  ONCE for every endpoint (single pool ⇒ id `default`). */
        credits: { default: { label: "Fundable credits" } },
        /** The vendor's OWN claim (design D27): pluck `meta.credits_used`
         *  (read + strip, one motion). Entry OMITTED when the field is
         *  absent (never `?? 0` — an absent meter must fall back to the
         *  derived fold; a present 0 on the FREE resolvers prunes to an
         *  empty claim). The claim WINS at settle; the model fold is the
         *  cross-check (`usage.mismatch.derived` on disagreement). The
         *  three account-level fields are billing facts too — stripped
         *  deep (the documented same-named-key risk, design D7). */
        consolidate: ({ data, utils }) => {
            const { value, rest } = utils.json.pluck(
                data.output,
                "$.meta.credits_used",
            );
            return {
                credits: {
                    ...(typeof value === "number" ? { default: value } : {}),
                },
                output: utils.json.omit(rest, [
                    "credit_source",
                    "monthly_credits_remaining",
                    "purchased_credits_remaining",
                ]),
            };
        },
        /** The generic QUANTITIES default (design D27): Fundable's uniform
         *  envelope is `{success, data, meta}` where a row-billed doc's
         *  `data` holds exactly ONE collection array (its key names the
         *  entity: deals / companies / investors / people), so the count
         *  is that array's length under the doc's own unit. Flat and FREE
         *  docs have nothing to count. */
        evidence: ({ data }) => {
            if (data.usage.model.kind !== "PER_UNIT") return { counts: {} };
            const envelope = data.output;
            const collection = envelope !== null &&
                    typeof envelope === "object" && !Array.isArray(envelope)
                ? envelope.data
                : undefined;
            const rows = collection !== null && collection !== undefined &&
                    typeof collection === "object" &&
                    !Array.isArray(collection)
                ? Object.values(collection).find(Array.isArray)
                : undefined;
            return {
                counts: {
                    [data.usage.model.unit]: Array.isArray(rows)
                        ? rows.length
                        : 0,
                },
            };
        },
    },
});
