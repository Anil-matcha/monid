import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testBundle,
    testSealedUnit,
} from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));

Deno.test("fundable resolvers: FREE model, no credits declared on the doc", async () => {
    const bundle = await testBundle();
    for (const id of ["fundable#location/search", "fundable#industry/search"]) {
        const doc = bundle.endpoints[id];
        assertEquals(doc.usage.model, { kind: "FREE" }, id);
        assertEquals(doc.usage.credits, {}, id);
    }
});

Deno.test("fundable#location/search happy (synthetic): free — the vendor's own 0 prunes, zero usage", async () => {
    const unit = await testSealedUnit("fundable#location/search");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        // the fixture URL proves the wire form: ?name=san+francisco
        input: { queryParams: { name: "san francisco" } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    // FREE model (D25/D26): nothing folds, nothing is evidenced; the
    // vendor's credits_used 0 is a present zero that prunes to an empty
    // claim — a nonzero claim here would be FN_CONTRACT
    assertEquals(result.usage, { credits: {}, evidence: {} });
    const output = result.output as Record<string, Record<string, unknown>>;
    assertEquals((output.data.locations as unknown[]).length, 2);
    assertEquals(output.meta, {});
});

Deno.test({
    name: "fundable#location/search live (gated on FUNDABLE_API_KEY)",
    ignore: liveSkip("fundable"),
    fn: async () => {
        const unit = await testSealedUnit("fundable#location/search");
        const result = await runEndpoint({
            unit,
            input: { queryParams: { name: "san francisco", type: "CITY" } },
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        assertEquals(result.usage, { credits: {}, evidence: {} });
    },
});
