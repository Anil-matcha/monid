import { assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { Json } from "@shared/core";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));

const EXPRESSION = {
    linemode: "R",
    searchline: {
        searchterm: "spotify",
        filters: [{ type: "lang", id: "en" }],
    },
};

Deno.test("opoint#search-advanced happy (synthetic): one call; same projection as /search, debug kept", async () => {
    const unit = await testSealedUnit("opoint#search-advanced");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: { body: { expressions: [EXPRESSION] } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, {
        credits: { default: 1 },
        evidence: { CALL: 1 },
    });
    const output = result.output as Record<string, unknown>;
    assertEquals(output.documents, 1);
    assertEquals(output.debug, {
        count: 1,
        lines: [{ state: 0, query: "spotify" }],
    });
    const doc = (output.document as Record<string, unknown>[])[0];
    assertEquals(doc.header, "Headline 0");
    assertEquals(doc.url, undefined, "tracking url leaked");
});

Deno.test("opoint#search-advanced provider error (recorded 401): data, zero usage", async () => {
    const unit = await testSealedUnit("opoint#search-advanced");
    const fixture = await loadFixture(`${fixturesDir}provider-error.json`);
    const result = await runEndpoint({
        unit,
        input: { body: { expressions: [EXPRESSION] } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 401);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

Deno.test("opoint#search-advanced: at least one expression, linemode from {R,O,E}, filter types closed", async () => {
    const unit = await testSealedUnit("opoint#search-advanced");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const rejected: Json[] = [
        { expressions: [] },
        { expressions: [{ ...EXPRESSION, linemode: "X" }] },
        {
            expressions: [{
                linemode: "R",
                searchline: {
                    searchterm: "spotify",
                    filters: [{ type: "bogus", id: 1 }],
                },
            }],
        },
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
    // numeric filter ids are as valid as literal ones
    const result = await runEndpoint({
        unit,
        input: {
            body: {
                expressions: [{
                    linemode: "R",
                    searchline: {
                        searchterm: "spotify",
                        filters: [{ type: "geo", id: 1203 }],
                    },
                }],
            },
        },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
});
