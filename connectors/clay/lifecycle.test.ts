import { assert, assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { Json, RunInput } from "@shared/core";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testBundle,
    testSealedUnit,
} from "@shared/testing";
import { directTransport, Engine } from "@monid/connector-engine";

/**
 * THE clay enrichment suite (fixture strategy v2): FOUR minimal shared
 * shape chains (fixtures/*.json) exercise all seven curated-enrichment
 * endpoints — `{{request.url}}` / `{{request.origin}}` bind each chain to
 * the endpoint under test, and `test-inputs.json` carries one
 * schema-valid body per endpoint. The three SEARCH docs are sync and have
 * their own per-endpoint tests.
 *
 * Clay declares NO `usage.consolidate` — responses carry no cost field —
 * so the DERIVED fold is the settled answer on every chain and no
 * `mismatch` key can ever appear (zUsage is strict; deep-equality proves
 * its absence).
 */

const HERE = fromFileUrl(new URL("./", import.meta.url));
const INPUTS = JSON.parse(
    await Deno.readTextFile(`${HERE}test-inputs.json`),
) as Record<string, RunInput["body"]>;

/** The seven async docs — the sync search family is tested per endpoint. */
const enrichmentIds = async (): Promise<string[]> => {
    const bundle = await testBundle();
    return Object.keys(bundle.endpoints)
        .filter((id) => id.startsWith("clay#enrichment/"))
        .sort();
};

const inputFor = (id: string): RunInput => {
    const body = INPUTS[id.split("#")[1]];
    assert(body !== undefined, `${id}: no test input in test-inputs.json`);
    return { body };
};

/** The one doc that prices a MISS (mobile-phone, drill 2026-09-08). */
const PRICES_THE_MISS = "clay#enrichment/mobile-phone";

/**
 * The v1 drill-measured per-run draw of a HIT, per endpoint (drills
 * 2026-08-20 / 2026-09-08, `clay credits balance` diffs closed to ±0).
 *
 * Written as LITERALS on purpose. Deriving them from each doc's own model
 * (`assembleUsage(doc.usage.model, …)`) would make this test a tautology —
 * the engine folds credits FROM the model, so an edited `consumes.amount`
 * would move both sides and pass. Clay reports no meter, so there is no
 * `usage.mismatch` to catch a drifted rate at runtime either: this table is
 * the only thing standing between a typo and a wrong bill.
 */
const HIT_DRAW: Record<string, Record<string, number>> = {
    "clay#enrichment/company-domain": { data_credit: 1, action: 1 },
    "clay#enrichment/company-employee-count": { data_credit: 0.5, action: 1 },
    "clay#enrichment/company-industry": { data_credit: 0.5, action: 1 },
    "clay#enrichment/company-job-openings": { data_credit: 0.5, action: 1 },
    "clay#enrichment/work-email": { data_credit: 0.6, action: 2 },
    "clay#enrichment/person": { data_credit: 0.5, action: 1 },
    "clay#enrichment/mobile-phone": { data_credit: 10, action: 2 },
};

Deno.test("clay: every enrichment endpoint settles the routine-hit chain at its own pinned rates", async () => {
    const fixture = await loadFixture(`${HERE}fixtures/routine-hit.json`);
    const ids = await enrichmentIds();
    // a new enrichment endpoint must state its measured draw here
    assertEquals(Object.keys(HIT_DRAW).sort(), ids);
    for (const id of ids) {
        const unit = await testSealedUnit(id);
        const result = await runEndpoint({
            unit,
            input: inputFor(id),
            mode: "replay",
            fixture,
        });
        assertEquals(result.httpStatus, 200, id);
        assertEquals(result.isProviderError, false, id);
        // one completed, non-empty item ⇒ the HIT lines, nothing else. No
        // vendor claim exists, so the derived fold IS usage — and it must
        // equal the independently measured draw.
        assertEquals(result.usage, {
            credits: HIT_DRAW[id],
            evidence: id === PRICES_THE_MISS
                ? {
                    enrichment_credits: 1,
                    enrichment_actions: 1,
                    miss_credits: 0,
                    miss_actions: 0,
                }
                : { enrichment_credits: 1, enrichment_actions: 1 },
        }, id);
        // engine-stamped provider timing: one still-running poll + terminal
        assertEquals(result.timing.attempts, 2, id);
    }
});

Deno.test("clay: a MISS is free on six functions and priced on mobile-phone", async () => {
    const fixture = await loadFixture(`${HERE}fixtures/routine-miss.json`);
    for (const id of await enrichmentIds()) {
        const unit = await testSealedUnit(id);
        const result = await runEndpoint({
            unit,
            input: inputFor(id),
            mode: "replay",
            fixture,
        });
        // A miss is a SUCCESSFUL run — the waterfall simply found nothing.
        assertEquals(result.httpStatus, 200, id);
        assertEquals(result.isProviderError, false, id);
        if (id === PRICES_THE_MISS) {
            // v1 billed 0 units here and absorbed the vendor's charge as an
            // internal actualCost. The doc is the vendor's rate card, so the
            // reduced draw settles: 0.5 data credit + 1 action.
            assertEquals(result.usage, {
                credits: { data_credit: 0.5, action: 1 },
                evidence: {
                    enrichment_credits: 0,
                    enrichment_actions: 0,
                    miss_credits: 1,
                    miss_actions: 1,
                },
            }, id);
        } else {
            // measured: these six draw NOTHING on a miss, so the fold
            // prunes to an empty claim while evidence still says zero
            assertEquals(result.usage, {
                credits: {},
                evidence: { enrichment_credits: 0, enrichment_actions: 0 },
            }, id);
        }
    }
});

Deno.test("clay: a FAILED item draws nothing anywhere — not even mobile-phone's miss lines", async () => {
    const fixture = await loadFixture(
        `${HERE}fixtures/routine-failed-item.json`,
    );
    for (const id of await enrichmentIds()) {
        const unit = await testSealedUnit(id);
        const result = await runEndpoint({
            unit,
            input: inputFor(id),
            mode: "replay",
            fixture,
        });
        assertEquals(result.httpStatus, 200, id);
        // a failure is NOT an exhausted waterfall: every line stays 0,
        // including mobile-phone's miss pair (the key set is asserted too —
        // an empty evidence map would vacuously satisfy a values-only check)
        assertEquals(result.usage, {
            credits: {},
            evidence: id === PRICES_THE_MISS
                ? {
                    enrichment_credits: 0,
                    enrichment_actions: 0,
                    miss_credits: 0,
                    miss_actions: 0,
                }
                : { enrichment_credits: 0, enrichment_actions: 0 },
        }, id);
        // terminal on the first poll — no still-running tick in this chain
        assertEquals(result.timing.attempts, 1, id);
    }
});

Deno.test("clay: a rejected start is DATA — 401, zero usage, nothing polled", async () => {
    const fixture = await loadFixture(`${HERE}fixtures/start-rejected.json`);
    for (const id of await enrichmentIds()) {
        const unit = await testSealedUnit(id);
        const result = await runEndpoint({
            unit,
            input: inputFor(id),
            mode: "replay",
            fixture,
        });
        assertEquals(result.httpStatus, 401, id);
        assertEquals(result.isProviderError, true, id);
        assertEquals(result.usage, { credits: {}, evidence: {} }, id);
        // the body relays verbatim — clay declares no output hooks
        assertEquals(
            (result.output as Record<string, unknown>).message,
            "Authentication required",
            id,
        );
        assertEquals(result.timing.attempts, 0, id);
    }
});

Deno.test("clay#enrichment/person: a body with no identifier is rejected before the wire", async () => {
    const unit = await testSealedUnit("clay#enrichment/person");
    const fixture = await loadFixture(`${HERE}fixtures/routine-hit.json`);
    const url = "https://www.linkedin.com/in/kareemamin";
    // Clay declares neither field required, so a no-target body would
    // start a routine run that resolves nobody and can still draw. OUR
    // rule binds it (design D13) as a compiled `anyOf` — enforced by the
    // engine's ajv pass, not by a `.refine` (which compiles away silently).
    const rejected: Json[] = [
        {},
        { "Email": "" },
        { "Professional Profile URL": "" },
        // .strict() holds on BOTH arms
        { "Professional Profile URL": url, "bogus": 1 },
        { "Email": "kamin@clay.com", "bogus": 1 },
    ];
    for (const body of rejected) {
        await assertRejects(
            () =>
                runEndpoint({ unit, input: { body }, mode: "replay", fixture }),
            Error,
            "INVALID_INPUT",
            JSON.stringify(body),
        );
    }
    // either identifier alone satisfies its arm, and both together satisfy
    // both (anyOf, not oneOf)
    const accepted: Json[] = [
        { "Professional Profile URL": url },
        { "Email": "kamin@clay.com" },
        { "Professional Profile URL": url, "Email": "kamin@clay.com" },
    ];
    for (const body of accepted) {
        const result = await runEndpoint({
            unit,
            input: { body },
            mode: "replay",
            fixture,
        });
        assertEquals(result.isProviderError, false, JSON.stringify(body));
    }
    // the rule reaches the DOC, not just the source: a future edit that
    // flattens the union back to an all-optional object fails here
    const body = unit.doc.input.schema.body as Record<string, Json>;
    const arms = body.anyOf as Record<string, Json>[];
    assertEquals(arms.length, 2);
    assertEquals(
        arms.map((arm) => arm.required).flat().sort(),
        ["Email", "Professional Profile URL"],
    );
    for (const arm of arms) assertEquals(arm.additionalProperties, false);
});

Deno.test("clay meta: caveats ride notes, capability text rides description", async () => {
    const bundle = await testBundle();
    // The six facts that cost a caller something if unknown live in
    // `meta.notes` (design D11, revised at the add-meta-notes merge) — and
    // MOVED there, rather than being duplicated out of the prose.
    const notesOf = (id: string) =>
        (bundle.endpoints[id].meta.notes ?? []).join(" ");
    const descOf = (id: string) => bundle.endpoints[id].meta.description ?? "";

    // mobile-phone's charged miss: the connector's most expensive surprise
    const phone = "clay#enrichment/mobile-phone";
    assert(notesOf(phone).includes("MISS IS CHARGED"), "miss note missing");
    assert(
        notesOf(phone).includes("0.5 data credits + 1 action"),
        "the miss note must name the draw",
    );
    assert(
        !descOf(phone).includes("miss is NOT free"),
        "the caveat must MOVE out of the description, not be duplicated",
    );
    // company-domain cannot miss — the note a chainer needs
    assert(
        notesOf("clay#enrichment/company-domain").includes("ALWAYS answers"),
        "fuzzy-matcher note missing",
    );
    // the search handle dies rather than degrading
    assert(
        notesOf("clay#search/query-mode/run").includes("expired"),
        "iterator expiry note missing",
    );
    // a rule that SURVIVES compilation is not a note (design D13): it rides
    // the input schema's anyOf, where a caller's tooling sees it
    assert(
        !notesOf("clay#enrichment/person").includes("at least one"),
        "the identifier rule belongs to the schema, not to notes",
    );
    // hints stay capability text — "call this next" is what an endpoint is
    // FOR, not a caveat
    assert(
        descOf("clay#enrichment/company-domain").includes("employee-count"),
        "the cross-endpoint chain belongs in the description",
    );
});

Deno.test("clay docs: ten endpoints, two families, one lifecycle", async () => {
    const bundle = await testBundle();
    const ids = Object.keys(bundle.endpoints).filter((id) =>
        id.startsWith("clay#")
    ).sort();
    assertEquals(ids, [
        "clay#enrichment/company-domain",
        "clay#enrichment/company-employee-count",
        "clay#enrichment/company-industry",
        "clay#enrichment/company-job-openings",
        "clay#enrichment/mobile-phone",
        "clay#enrichment/person",
        "clay#enrichment/work-email",
        "clay#search/query-mode",
        "clay#search/query-mode/reference",
        "clay#search/query-mode/run",
    ]);
    const first = bundle.endpoints[ids[0]];
    for (const id of ids) {
        const doc = bundle.endpoints[id];
        // one auth fn, one poll fn, provider-wide
        assertEquals(doc.auth.inject.$fn.key, first.auth.inject.$fn.key, id);
        assertEquals(
            doc.lifecycle?.poll?.$fn.key,
            first.lifecycle?.poll?.$fn.key,
            id,
        );
        assertEquals(doc.timeouts.pollMs, 5_000, id);
        assertEquals(doc.timeouts.runMs, 300_000, id);
        // Clay reports NO meter, so there is no vendor claim to lift and
        // no consolidate anywhere in the connector (design D8) — the
        // derived fold is always the settled answer.
        assertEquals(doc.usage.consolidate, undefined, id);
        // one strip fn, provider-wide (design D7); errors relay verbatim,
        // so there is no fromError
        assertEquals(
            doc.output.fromResponse?.$fn.key,
            first.output.fromResponse?.$fn.key,
            id,
        );
        assert(doc.output.fromResponse, `${id}: the ledger strip must run`);
        assertEquals(doc.output.fromError, undefined, id);
    }
    // the {search_id} placeholder survives into the compiled url while the
    // PUBLIC identity stays brace-free; routine ids stay percent-encoded
    // exactly as v1 sent them
    assertEquals(
        bundle.endpoints["clay#search/query-mode/run"].request.url,
        "https://api.clay.com/public/v0/search/query-mode/{search_id}/run",
    );
    assertEquals(
        bundle.endpoints["clay#enrichment/company-domain"].request.url,
        "https://api.clay.com/public/v0/routines/function%3At_0tk3d4qnbeQmcGWPukV/run",
    );
});

Deno.test("clay: fn provenance — one routine lifecycle, one relay, two quantity fns", async () => {
    const bundle = await testBundle();
    const routineStart = bundle.endpoints["clay#enrichment/company-domain"]
        .lifecycle?.start
        ?.$fn.key;
    const relayStart = bundle.endpoints["clay#search/query-mode/reference"]
        .lifecycle?.start
        ?.$fn.key;
    assert(routineStart && relayStart);
    assert(
        routineStart !== relayStart,
        "the search relay must not be the routine start",
    );
    // the routine start is the PROVIDER's, shared by all seven
    for (const id of await enrichmentIds()) {
        assertEquals(
            bundle.endpoints[id].lifecycle?.start?.$fn.key,
            routineStart,
            id,
        );
    }
    assertEquals(
        bundle.fnTable[routineStart].provenance,
        "connectors/clay/provider.ts#lifecycle.start",
    );
    // the three search docs share ONE relay override (identical source ⇒
    // one interned entry)
    for (
        const id of [
            "clay#search/query-mode",
            "clay#search/query-mode/reference",
            "clay#search/query-mode/run",
        ]
    ) {
        assertEquals(
            bundle.endpoints[id].lifecycle?.start?.$fn.key,
            relayStart,
            id,
        );
    }
    // ≥2 metered components force BOTH quantity fns doc-level, but the
    // sources are identical: ONE estimate across all seven, ONE evidence
    // across the six that do not price a miss
    const estimate =
        bundle.endpoints["clay#enrichment/company-domain"].usage.estimate.$fn
            .key;
    const evidence =
        bundle.endpoints["clay#enrichment/company-domain"].usage.evidence.$fn
            .key;
    for (const id of await enrichmentIds()) {
        assertEquals(bundle.endpoints[id].usage.estimate.$fn.key, estimate, id);
        if (id === PRICES_THE_MISS) {
            assert(
                bundle.endpoints[id].usage.evidence.$fn.key !== evidence,
                "mobile-phone owns its two-armed evidence",
            );
        } else {
            assertEquals(
                bundle.endpoints[id].usage.evidence.$fn.key,
                evidence,
                id,
            );
        }
    }
    // the two FREE search docs declare neither — the compiler synthesizes
    // the one lawful `() => ({counts: {}})`
    const synthesized =
        bundle.endpoints["clay#search/query-mode"].usage.estimate.$fn.key;
    assertEquals(
        bundle.fnTable[synthesized].provenance,
        "core#usage.synthesizedEmpty",
    );
    assertEquals(
        bundle.endpoints["clay#search/query-mode/reference"].usage.evidence.$fn
            .key,
        synthesized,
    );
});

Deno.test("clay: the enrichment estimate is the HIT arm, deduced without IO", async () => {
    for (const id of await enrichmentIds()) {
        const unit = await testSealedUnit(id);
        const engine = new Engine({
            // estimate is PURE — a transport that rejects proves no IO
            transport: directTransport({
                params: () => Promise.resolve({ apiKey: "test-key" }),
                fetch: () => Promise.reject(new Error("estimate must not IO")),
            }),
        });
        const loaded = await engine.load(unit);
        const estimate = await loaded.estimate(inputFor(id));
        // one submitted item ⇒ at most one enrichment; mobile-phone holds
        // its hit arm (10.0 + 2), the worst case of its two quanta. Held
        // against the same measured literals the settle is held to.
        assertEquals(estimate.evidence, {
            enrichment_credits: 1,
            enrichment_actions: 1,
        }, id);
        assertEquals(estimate.credits, HIT_DRAW[id], id);
    }
});

Deno.test({
    name:
        "clay#enrichment/company-domain live (gated on CLAY_API_KEY) — the wire body and the pinned rate",
    ignore: liveSkip("clay"),
    fn: async () => {
        // The ONE live enrichment case: replay matches on method + url only,
        // so the `items: [{id, inputs}]` wrapping the routine start builds
        // is otherwise unverified — and Clay reports no meter, so this is
        // also the only place the async family's rate is checked against a
        // real run. company-domain is the cheapest deterministic function
        // (its fuzzy matcher always answers, so the hit arm always settles).
        const unit = await testSealedUnit("clay#enrichment/company-domain");
        const result = await runEndpoint({
            unit,
            input: inputFor("clay#enrichment/company-domain"),
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        // the routine accepted our body and returned a result ⇒ the hit
        // arm settles at the measured draw
        assertEquals(
            result.usage,
            {
                credits: HIT_DRAW["clay#enrichment/company-domain"],
                evidence: { enrichment_credits: 1, enrichment_actions: 1 },
            },
        );
        const items = (result.output as Record<string, unknown>).data as Record<
            string,
            unknown
        >[];
        assertEquals(items.length, 1);
        assertEquals(items[0].status, "complete");
        assertEquals(
            typeof (items[0].result as Record<string, unknown>).Domain,
            "string",
        );
    },
});
