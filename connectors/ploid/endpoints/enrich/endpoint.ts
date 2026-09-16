import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zPloidEnrichBody } from "./schema/inputs.ts";

/**
 * `POST /v1/enrich` — three independently priced components ride one call
 * (`profile`, `email`, `phone`; the request's `enrichments` picks any
 * subset). The vendor charges FOUND-ONLY: an unresolved component comes
 * back `null` and is not charged, so each component is a metered line
 * whose quantity is "did the field resolve" (0/1). v1 stamped those
 * quantities onto the body from a custom start; here the evidence fn reads
 * them off the raw response directly — no stamp, no start (D3).
 */
export default defineEndpoint({
    meta: {
        displayName: "Enrich Person Contacts",
        summary:
            "Enrich a known LinkedIn identity with fresh profile, email, and/or phone data.",
        description: "Resolve one person from their LinkedIn profile URL " +
            "into selected components: a refreshed profile (name, " +
            "headline, company, location, skills, employers, schools, " +
            "years of experience, open-to-work flag, follower count), a " +
            "contact email, and/or a mobile phone number — each with a " +
            "confidence grade (guess / strong / verified) and verification " +
            "status. Request any subset via enrichments; an unresolved " +
            "component returns null and is not charged. Email is priced " +
            "at the work-email rate; when only a personal email resolves " +
            "the vendor bills its fallback rate (3 ACU) instead. Suited " +
            "for contact appending, lead enrichment, and verifying a " +
            "person's current role before outreach.",
        docsUrl: "https://ploid.com/documentation/api/enrichment",
        categories: ["people-enrichment"],
    },
    request: { method: "POST", path: "/v1/enrich" },
    // `enrichments` carries the VENDOR default (["profile"], OpenAPI 2.0.0)
    // so the estimate reads one typed array (design D25).
    input: {
        schema: {
            body: zPloidEnrichBody.extend({
                enrichments: zPloidEnrichBody.shape.enrichments.unwrap()
                    .default(["profile"]),
            }),
        },
    },
    usage: {
        /** Three found-only lines, no base fee (AND = COMPOSITE). Rates
         *  at cost (drill 2026-09-05): profile 1 ACU, work email 1 ACU,
         *  phone 10 ACU (vendor list, not drilled) — v1 makeTieredPrice
         *  Profile / Email / Phone. The personal-email fallback (3 ACU)
         *  is not distinguishable in the response, so the line carries
         *  the work rate and the vendor's `meta.acu_used` claim settles
         *  the difference (D3). */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                profile: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "profiles",
                    consumes: { credit: "default", amount: 1 },
                    description: "1 when the refreshed profile resolved",
                },
                email: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "emails",
                    consumes: { credit: "default", amount: 1 },
                    description: "1 when an email resolved (work-email " +
                        "rate; a personal-email fallback settles at the " +
                        "vendor's 3 ACU from the meter)",
                },
                phone: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "phone numbers",
                    consumes: { credit: "default", amount: 10 },
                    description: "1 when a phone number resolved",
                },
            },
        },
        /** Every requested component is promised at 1 (typed read of the
         *  defaulted `enrichments`); unrequested ones at 0 so the vector
         *  is complete (design D24). */
        estimate: ({ data }) => {
            const requested = data.input.body.enrichments;
            return {
                counts: {
                    "profile": requested.includes("profile") ? 1 : 0,
                    "email": requested.includes("email") ? 1 : 0,
                    "phone": requested.includes("phone") ? 1 : 0,
                },
            };
        },
        /** Found-only: a component counts 1 when its field is present and
         *  non-null on the raw body (v1 componentUnits). */
        evidence: ({ data, utils }) => {
            const profile = utils.json.optionalGet(
                data.output,
                "$.data.linkedin_profile",
            );
            const email = utils.json.optionalGet(data.output, "$.data.email");
            const phone = utils.json.optionalGet(data.output, "$.data.phone");
            return {
                counts: {
                    "profile": profile !== undefined && profile !== null
                        ? 1
                        : 0,
                    "email": email !== undefined && email !== null ? 1 : 0,
                    "phone": phone !== undefined && phone !== null ? 1 : 0,
                },
            };
        },
    },
});
