import { z } from "zod";

/**
 * The credit-system DECLARATION (design D26, revised D6): `usage.credits`
 * sits BESIDE `usage.model`, resolved KEY-WISE endpoint over provider —
 * a provider declares its pool SET once (each pool drained by at least
 * one endpoint) and an endpoint adds or restates only what diverges. A
 * single-pool provider names its one system `default`; named ids exist
 * for vendors metering ≥2 genuinely independent pools (pdl's four
 * `x-call-credits-type` balances). The broker's card is keyed by
 * (provider, creditId) — credit → money is the ONE per-provider fact
 * left outside the doc.
 */
export const zCreditSystem = z.strictObject({
    /** Short display name for billing surfaces ("Akta credits",
     *  "US dollars", "Exa queries"). */
    label: z.string().min(1).max(40).optional(),
    description: z.string().min(1).optional(),
});
export type CreditSystem = z.infer<typeof zCreditSystem>;

export const zCredits = z.record(z.string().min(1), zCreditSystem);
export type Credits = z.infer<typeof zCredits>;

/**
 * The consumption RATE (design D26): every billable line (PER_CALL and
 * PER_UNIT, leaf or composite component) states its draw against a
 * declared credit system — the def IS the rate card. For PER_UNIT lines,
 * `amount` buys `every` units (a MODEL-level field, default 1): fold =
 * ceil(quantity / every) × amount, billed in whole increments. For
 * PER_CALL lines the draw is flat, once per successful run.
 */
export const zConsumes = z.strictObject({
    /** A key of the resolved `usage.credits` map (compile-checked). */
    credit: z.string().min(1),
    /** Credits drawn per `every` units (PER_UNIT) / per run (PER_CALL). */
    amount: z.number().positive(),
});
export type Consumes = z.infer<typeof zConsumes>;
