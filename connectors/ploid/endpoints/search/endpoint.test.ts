import { assert, assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { Json } from "@shared/core";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testBundle,
    testSealedUnit,
} from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));

Deno.test("ploid: fn provenance — one consolidate for all ten, the agent alone owns a lifecycle", async () => {
    const bundle = await testBundle();
    const ids = Object.keys(bundle.endpoints).filter((id) =>
        id.startsWith("ploid#")
    ).sort();
    assertEquals(ids.length, 10);
    const search = bundle.endpoints["ploid#v1/search"];
    const consolidateKey = search.usage.consolidate?.$fn.key;
    assert(consolidateKey !== undefined);
    for (const id of ids) {
        const doc = bundle.endpoints[id];
        assertEquals(doc.usage.consolidate?.$fn.key, consolidateKey, id);
        assertEquals(
            doc.usage.credits,
            { default: { label: "Ploid ACU" } },
            id,
        );
        // no doc declares a fromResponse / fromError; only the agent shapes
        // its request
        assertEquals(doc.output.fromResponse, undefined, id);
        assertEquals(
            doc.input.toRequest !== undefined,
            id === "ploid#v1/agent",
            id,
        );
        assertEquals(
            doc.lifecycle?.start !== undefined,
            id === "ploid#v1/agent",
            id,
        );
    }
    // flat docs (socials + the five reads): estimate and evidence are the
    // ONE synthesized fn; metered docs own both
    const synthesizedKey =
        bundle.endpoints["ploid#v1/socials"].usage.estimate.$fn.key;
    assertEquals(
        bundle.fnTable[synthesizedKey].provenance,
        "core#usage.synthesizedEmpty",
    );
    const flat = [
        "ploid#v1/socials",
        "ploid#v1/linkedin/profile",
        "ploid#v1/linkedin/posts",
        "ploid#v1/linkedin/profiles/comments",
        "ploid#v1/linkedin/companies/get",
        "ploid#v1/linkedin/companies/posts",
    ];
    for (const id of flat) {
        assertEquals(
            bundle.endpoints[id].usage.estimate.$fn.key,
            synthesizedKey,
            id,
        );
        assertEquals(
            bundle.endpoints[id].usage.evidence.$fn.key,
            synthesizedKey,
            id,
        );
    }
    for (const id of ids.filter((id) => !flat.includes(id))) {
        assert(
            bundle.endpoints[id].usage.estimate.$fn.key !== synthesizedKey,
            id,
        );
        assert(
            bundle.endpoints[id].usage.evidence.$fn.key !== synthesizedKey,
            id,
        );
    }
});

Deno.test("ploid#v1/search happy (synthetic): 7 results = 1 started block; meter 0.1 claims; warning survives, internals do not", async () => {
    const unit = await testSealedUnit("ploid#v1/search");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: { body: { query: "fintech engineers", num_results: 7 } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    // claim 0.1 = fold ceil(7/10) × 0.1 — no mismatch key
    assertEquals(result.usage, {
        credits: { default: 0.1 },
        evidence: { RESULT: 7 },
    });
    const output = result.output as Record<string, Record<string, unknown>>;
    assertEquals((output.data.results as unknown[]).length, 7);
    assertEquals(output.meta.warning, "search_timeout");
    assertEquals(output.meta.credits_charged, undefined);
    assertEquals(output.meta.remaining_credits, undefined);
    assertEquals(output.meta.request_id, undefined);
});

Deno.test("ploid#v1/search empty (synthetic): zero results, zero ACU", async () => {
    const unit = await testSealedUnit("ploid#v1/search");
    const fixture = await loadFixture(`${fixturesDir}synthetic-empty.json`);
    const result = await runEndpoint({
        unit,
        input: { body: { query: "zxqvbnmlkjhgf", num_results: 10 } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    // a present 0 claim prunes to an empty claim; the fold is 0 too
    assertEquals(result.usage, { credits: {}, evidence: { RESULT: 0 } });
});

Deno.test("ploid#v1/search provider error (recorded 401): the vendor envelope is data, zero usage", async () => {
    const unit = await testSealedUnit("ploid#v1/search");
    const fixture = await loadFixture(`${fixturesDir}provider-error.json`);
    const result = await runEndpoint({
        unit,
        input: { body: { query: "fintech engineers", num_results: 25 } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 401);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals(
        (result.output as Record<string, Record<string, unknown>>).error.code,
        "invalid_api_key",
    );
});

Deno.test("ploid#v1/search: num_results required, unknown fields rejected at every level, bounds 1-100", async () => {
    const unit = await testSealedUnit("ploid#v1/search");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const rejected: Json[] = [
        { query: "x" },
        { query: "x", num_results: 7, unknown_field: true },
        { query: "x", num_results: 101 },
        { query: "x", num_results: 7, type: "fast" },
        // a typo inside filters must not silently become an unfiltered search
        { query: "x", num_results: 7, filters: { locaton: "Boston" } },
        { query: "x", num_results: 7, contents: { field: ["name"] } },
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
});

Deno.test({
    name: "ploid#v1/search live (gated on PLOID_API_KEY)",
    ignore: liveSkip("ploid"),
    fn: async () => {
        const unit = await testSealedUnit("ploid#v1/search");
        const result = await runEndpoint({
            unit,
            input: {
                body: { query: "software engineers at Stripe", num_results: 3 },
            },
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        assertEquals(result.usage.evidence.RESULT !== undefined, true);
        assertEquals(typeof result.usage.credits.default, "number");
    },
});
