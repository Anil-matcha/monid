import { assert, assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testSealedUnit,
} from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));

Deno.test("clay#search/query-mode/reference happy (recorded): the grammar document, free", async () => {
    const unit = await testSealedUnit("clay#search/query-mode/reference");
    const fixture = await loadFixture(`${fixturesDir}happy.json`);
    const result = await runEndpoint({
        unit,
        input: {},
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    const reference = (result.output as Record<string, unknown>)
        .reference as string;
    assert(typeof reference === "string");
    assert(reference.includes("Clay search query reference"));
});

Deno.test({
    name: "clay#search/query-mode/reference live (gated on CLAY_API_KEY)",
    ignore: liveSkip("clay"),
    fn: async () => {
        const unit = await testSealedUnit("clay#search/query-mode/reference");
        const result = await runEndpoint({ unit, input: {}, mode: "live" });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        assertEquals(result.usage, { credits: {}, evidence: {} });
        assertEquals(
            typeof (result.output as Record<string, unknown>).reference,
            "string",
        );
    },
});
