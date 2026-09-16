import { assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { Json } from "@shared/core";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));

Deno.test("ploid#v1/linkedin/search happy (synthetic): 15 matches = 2 started blocks; meter 0.2 claims; cursor stays", async () => {
    const unit = await testSealedUnit("ploid#v1/linkedin/search");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: { body: { filters: { keywords: "engineer" }, limit: 15 } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, {
        credits: { default: 0.2 },
        evidence: { RESULT: 15 },
    });
    const output = result.output as Record<string, Record<string, unknown>>;
    assertEquals((output.data.items as unknown[]).length, 15);
    assertEquals(output.meta.cursor, null);
    assertEquals(output.meta.credits_charged, undefined);
});

Deno.test("ploid#v1/linkedin/search provider error (recorded 401): data, zero usage", async () => {
    const unit = await testSealedUnit("ploid#v1/linkedin/search");
    const fixture = await loadFixture(`${fixturesDir}provider-error.json`);
    const result = await runEndpoint({
        unit,
        input: { body: { filters: { keywords: "engineer" }, limit: 15 } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 401);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

Deno.test("ploid#v1/linkedin/search: limit required (1-100); filters take a value or a list", async () => {
    const unit = await testSealedUnit("ploid#v1/linkedin/search");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const rejected: Json[] = [
        { filters: { keywords: "engineer" } },
        { limit: 0 },
        { limit: 15, filters: { title: 7 } },
        // a typo inside filters must not silently become an unfiltered search
        { limit: 15, filters: { current_company: "Stripe" } },
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
    const result = await runEndpoint({
        unit,
        input: { body: { limit: 15, filters: { title: ["CTO", "VP Eng"] } } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
});
