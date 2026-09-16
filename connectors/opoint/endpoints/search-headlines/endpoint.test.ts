import { assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { Json } from "@shared/core";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));

Deno.test("opoint#search-headlines happy (synthetic): one call; headline rows carry no snippet", async () => {
    const unit = await testSealedUnit("opoint#search-headlines");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: { body: { searchterm: "tesla" } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, {
        credits: { default: 1 },
        evidence: { CALL: 1 },
    });
    const output = result.output as Record<string, unknown>;
    const docs = output.document as Record<string, unknown>[];
    assertEquals(docs.length, 2);
    for (const doc of docs) {
        assertEquals(typeof doc.header, "string");
        assertEquals(doc.snippet, undefined, "headlines carry no text");
        assertEquals(doc.url, undefined, "tracking url leaked");
    }
});

Deno.test("opoint#search-headlines provider error (recorded 401): data, zero usage", async () => {
    const unit = await testSealedUnit("opoint#search-headlines");
    const fixture = await loadFixture(`${fixturesDir}provider-error.json`);
    const result = await runEndpoint({
        unit,
        input: { body: { searchterm: "tesla" } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 401);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

Deno.test("opoint#search-headlines: searchterm required, allow-list strict", async () => {
    const unit = await testSealedUnit("opoint#search-headlines");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const rejected: Json[] = [
        { params: { requestedarticles: 20 } },
        { searchterm: "tesla", params: { groupidentical: true } },
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
