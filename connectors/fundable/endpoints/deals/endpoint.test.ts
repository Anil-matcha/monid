import { assertEquals, assertRejects } from "@std/assert";
import type { Json } from "@shared/core";
import { fromFileUrl } from "@std/path";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testBundle,
    testSealedUnit,
} from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));

const ROW_BILLED_BODY = [
    "fundable#deals",
    "fundable#companies",
    "fundable#investors",
    "fundable#people",
];
const ROW_BILLED_QUERY = [
    "fundable#company/deals",
    "fundable#investor/deals",
    "fundable#person/deals",
];

Deno.test("fundable: usage fn provenance — provider settle fns shared by all 17, estimates own vs synthesized", async () => {
    const bundle = await testBundle();
    const ids = Object.keys(bundle.endpoints).filter((id) =>
        id.startsWith("fundable#")
    ).sort();
    assertEquals(ids.length, 17);
    const first = bundle.endpoints[ids[0]];
    for (const id of ids) {
        const doc = bundle.endpoints[id];
        // the vendor meter (meta.credits_used) and the collection count are
        // PROVIDER-wide facts — ONE consolidate, ONE evidence, ONE auth fn
        assertEquals(
            doc.usage.consolidate?.$fn.key,
            first.usage.consolidate?.$fn.key,
            id,
        );
        assertEquals(
            doc.usage.evidence.$fn.key,
            first.usage.evidence.$fn.key,
            id,
        );
        assertEquals(doc.auth.inject.$fn.key, first.auth.inject.$fn.key, id);
        // no endpoint reshapes the wire or the output
        assertEquals(doc.input.toRequest, undefined, id);
        assertEquals(doc.output.fromResponse, undefined, id);
    }
    // D27 subclassing: the seven row-billed docs OWN their estimate — the
    // four POST searches intern one body-reading fn, the three GET
    // histories one queryParams-reading fn
    const bodyKey = bundle.endpoints["fundable#deals"].usage.estimate.$fn.key;
    for (const id of ROW_BILLED_BODY) {
        assertEquals(bundle.endpoints[id].usage.estimate.$fn.key, bodyKey, id);
    }
    const queryKey =
        bundle.endpoints["fundable#company/deals"].usage.estimate.$fn.key;
    for (const id of ROW_BILLED_QUERY) {
        assertEquals(
            bundle.endpoints[id].usage.estimate.$fn.key,
            queryKey,
            id,
        );
    }
    // the ten flat/FREE docs declare no estimate — the compiler
    // synthesizes the one lawful `() => ({counts: {}})`
    const synthesizedKey =
        bundle.endpoints["fundable#company"].usage.estimate.$fn.key;
    assertEquals(
        bundle.fnTable[synthesizedKey].provenance,
        "core#usage.synthesizedEmpty",
    );
    for (
        const id of ids.filter((id) =>
            !ROW_BILLED_BODY.includes(id) && !ROW_BILLED_QUERY.includes(id)
        )
    ) {
        assertEquals(
            bundle.endpoints[id].usage.estimate.$fn.key,
            synthesizedKey,
            id,
        );
    }
    // the {id} placeholders survive into the compiled urls (engine
    // substitutes pathParams at run time) while the PUBLIC identity is
    // the brace-free singular form
    assertEquals(
        bundle.endpoints["fundable#deal"].request.url,
        "https://www.tryfundable.ai/api/v1/deals/{id}",
    );
    assertEquals(
        bundle.endpoints["fundable#deal/investors"].request.url,
        "https://www.tryfundable.ai/api/v1/deals/{id}/investors",
    );
});

Deno.test("fundable#deals happy (synthetic): rows are the unit; the vendor's credits_used claim wins; account fields absorbed", async () => {
    const unit = await testSealedUnit("fundable#deals");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: {
            body: {
                deal: { financing_types: [{ type: "SEED" }] },
                page_size: 3,
            },
        },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    // D27 claim-wins: meta.credits_used (3) IS usage.credits; our fold
    // (3 rows × 1 credit) agrees, so no mismatch key settles (zUsage is
    // strict — deep-equality proves its absence)
    assertEquals(result.usage, {
        credits: { default: 3 },
        evidence: { RESULT: 3 },
    });
    // the meter and the account-level fields leave the payload; the
    // pagination keys the caller needs stay
    const output = result.output as Record<string, unknown>;
    assertEquals(output.meta, { total_count: 42, page: 0, page_size: 3 });
    assertEquals(
        ((output.data as Record<string, unknown>).deals as unknown[]).length,
        3,
    );
});

Deno.test("fundable#deals empty (synthetic): zero rows bill nothing", async () => {
    const unit = await testSealedUnit("fundable#deals");
    const fixture = await loadFixture(`${fixturesDir}synthetic-empty.json`);
    const result = await runEndpoint({
        unit,
        input: { body: { deal: { size_min: 1e15 }, page_size: 1 } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    // the vendor's credits_used is 0 — a present zero PRUNES to an empty
    // claim (D27), so the DERIVED fold settles: 0 rows × 1 credit draws
    // nothing (a zero draw is not written), evidence still says 0 rows
    assertEquals(result.usage, { credits: {}, evidence: { RESULT: 0 } });
});

Deno.test("fundable#deals provider error (synthetic 429): data, zero usage, raw body through", async () => {
    const unit = await testSealedUnit("fundable#deals");
    const fixture = await loadFixture(
        `${fixturesDir}synthetic-provider-error.json`,
    );
    const result = await runEndpoint({
        unit,
        input: {
            body: {
                deal: { financing_types: [{ type: "SEED" }] },
                page_size: 10,
            },
        },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 429);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals(
        (result.output as Record<string, Record<string, unknown>>).error.code,
        "RATE_LIMIT_EXCEEDED",
    );
});

Deno.test("fundable#deals: page_size is REQUIRED and capped at 100 by the binding; dates are calendar-checked", async () => {
    const unit = await testSealedUnit("fundable#deals");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const rejected: Json[] = [
        // the primary limiting knob is the estimate's whole basis (D25)
        { deal: { financing_types: [{ type: "SEED" }] } },
        // platform cap (upstream allows 500) — v1 decision, kept
        { page_size: 101 },
        { page_size: 0 },
        // z.iso.date(): impossible calendar day
        { deal: { date_start: "2024-02-30" }, page_size: 3 },
        // unknown key at a nested level (.strict() survives compilation)
        { deal: { bogus: 1 }, page_size: 3 },
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
    // the near-miss positives: page_size 100 and a real leap day pass
    // validation (they fail later, at replay URL/body matching — proving
    // the schema let them through is not needed: the fixture matches by
    // method + url only, so they simply replay)
    const ok = await runEndpoint({
        unit,
        input: {
            body: { deal: { date_start: "2024-02-29" }, page_size: 100 },
        },
        mode: "replay",
        fixture,
    });
    assertEquals(ok.isProviderError, false);
});

Deno.test({
    name: "fundable#deals live (gated on FUNDABLE_API_KEY)",
    ignore: liveSkip("fundable"),
    fn: async () => {
        const unit = await testSealedUnit("fundable#deals");
        const result = await runEndpoint({
            unit,
            input: {
                body: {
                    deal: { financing_types: [{ type: "SEED" }] },
                    page_size: 2,
                },
            },
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        // shape, not amounts: the vendor claim is the credits truth
        assertEquals(Object.keys(result.usage.evidence), ["RESULT"]);
        assertEquals(typeof result.usage.credits.default, "number");
        const output = result.output as Record<string, Record<string, unknown>>;
        assertEquals("credits_used" in output.meta, false);
    },
});
