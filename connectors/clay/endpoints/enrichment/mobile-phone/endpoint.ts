import { defineEndpoint, Unit, UsageModelKind } from "@shared/core";
import { zMobilePhoneBody } from "./schema/inputs.ts";

/**
 * Clay-managed "Mobile Phone" — a multi-vendor phone-data waterfall, and
 * the ONE Clay function the vendor charges for on a MISS.
 *
 * Every other enrichment doc prices a single quantum (a completed, filled
 * result); this one prices TWO — the hit and the miss — because Clay draws
 * differently for each (drill 2026-09-08). v1 billed the caller 0 units on
 * a miss and recorded the vendor's charge as an internal `actualCost`; the
 * doc is the vendor's rate card, so here the miss is a priced line and the
 * settle reports what Clay actually took.
 */
export default defineEndpoint({
    meta: {
        displayName: "Find Mobile Phone",
        summary:
            "Find a person's mobile phone number from their LinkedIn URL, name, and company.",
        description: "Cascades a person through multiple phone-data " +
            "vendors, keyed by LinkedIn profile URL + full name + company " +
            'name. Returns { "Mobile Phone" } in E.164 form, or an empty ' +
            "string when no vendor has a number. Supports company domain, " +
            "work email, and personal email as extra clues. Chain onward: " +
            "pass the LinkedIn URL as 'Professional Profile URL' to the " +
            "enrich-person endpoint. Suited for direct-dial outreach and " +
            "contact-record completion. Async: the run is polled to " +
            "completion.",
        docsUrl: "https://developers.clay.com/routines/clay-managed-functions",
        categories: ["people-enrichment"],
        /** The exception to the rule every other Clay enrichment follows,
         *  and the single most expensive surprise in this connector: a
         *  caller who budgets misses as free is wrong here, and only
         *  here. */
        notes: [
            "Unlike every other Clay enrichment, a MISS IS CHARGED. An " +
            "exhausted waterfall draws 0.5 data credits + 1 action, " +
            "against a hit's 10 + 2. Only an item that FAILS is free.",

            "A miss can take up to ~3 minutes: every phone-data vendor is " +
            "tried before the run completes empty. A hit usually settles " +
            "in seconds.",
        ],
    },
    endpoint: "/enrichment/mobile-phone",
    request: {
        method: "POST",
        path: "/routines/function%3At_0tkthadtezqoRdgzpbf/run",
    },
    input: { schema: { body: zMobilePhoneBody } },
    usage: {
        /** FOUR lines: two quanta × two pools (design D26 — a line pins
         *  exactly one `consumes.credit`, and a condition is a COUNTING
         *  rule owned by evidence, never a model shape, design D19).
         *  Measured draws (drill 2026-09-08, ledger closed to ±0): a HIT
         *  takes 10.0 data credits + 2 actions (the vendor quoted 10.8);
         *  a MISS still takes 0.5 data credit + 1 action. */
        model: {
            kind: UsageModelKind.COMPOSITE,
            components: {
                enrichment_credits: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "numbers found",
                    description: "enrichments that returned a number",
                    consumes: { credit: "data_credit", amount: 10.0 },
                },
                enrichment_actions: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "hit actions",
                    description: "actions consumed by a run that found one",
                    consumes: { credit: "action", amount: 2 },
                },
                miss_credits: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "numbers not found",
                    description:
                        "enrichments that completed with no number (still charged)",
                    consumes: { credit: "data_credit", amount: 0.5 },
                },
                miss_actions: {
                    kind: UsageModelKind.PER_UNIT,
                    unit: Unit.RESULT,
                    label: "miss actions",
                    description: "actions consumed by an exhausted waterfall",
                    consumes: { credit: "action", amount: 1 },
                },
            },
        },
        /** The HIT arm is the worst case (10.0 + 2 against 0.5 + 1), so
         *  it is the hold. A SUBSET of the metered line ids is legal —
         *  the miss lines are simply not promised. Source-identical to
         *  every other enrichment doc's estimate, so it interns with
         *  them. */
        estimate: () => ({
            counts: { enrichment_credits: 1, enrichment_actions: 1 },
        }),
        /** The ONE doc-specific settle: partition completed items into
         *  filled results (the hit lines) and empty ones (the miss lines
         *  — Clay answers `complete` with `{}` or `{"Mobile Phone": ""}`).
         *  A `failed` item is neither: the vendor charges nothing for it. */
        evidence: ({ data, utils }) => {
            const items = utils.json.optionalGet(data.output, "$.data");
            let hits = 0;
            let misses = 0;
            if (Array.isArray(items)) {
                for (const item of items) {
                    if (
                        item === null || typeof item !== "object" ||
                        Array.isArray(item) || item.status !== "complete"
                    ) {
                        continue;
                    }
                    const result = item.result;
                    const filled = result !== null &&
                        typeof result === "object" &&
                        !Array.isArray(result) &&
                        Object.values(result).some((value) =>
                            value !== null && value !== "" &&
                            !(typeof value === "object" && value !== null &&
                                !Array.isArray(value) &&
                                Object.keys(value).length === 0)
                        );
                    if (filled) hits = hits + 1;
                    else misses = misses + 1;
                }
            }
            return {
                counts: {
                    enrichment_credits: hits,
                    enrichment_actions: hits,
                    miss_credits: misses,
                    miss_actions: misses,
                },
            };
        },
    },
});
