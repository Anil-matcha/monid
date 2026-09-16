import { assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { Json } from "@shared/core";
import { loadFixture, runEndpoint, testSealedUnit } from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));

const ARTICLES = [
    { id_site: 11, id_article: 1 },
    { id_site: 11, id_article: 2 },
];

Deno.test("opoint#search-by-ids happy (synthetic): one call; the requested articles come back projected", async () => {
    const unit = await testSealedUnit("opoint#search-by-ids");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: { body: { params: { articles: ARTICLES } } },
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
    // the requested pairs come back, in order
    assertEquals(
        docs.map((doc) => ({
            id_site: doc.id_site,
            id_article: doc.id_article,
        })),
        ARTICLES,
    );
    assertEquals(docs[1].url, undefined, "tracking url leaked");
});

Deno.test("opoint#search-by-ids provider error (recorded 401): data, zero usage", async () => {
    const unit = await testSealedUnit("opoint#search-by-ids");
    const fixture = await loadFixture(`${fixturesDir}provider-error.json`);
    const result = await runEndpoint({
        unit,
        input: { body: { params: { articles: ARTICLES } } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 401);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

Deno.test("opoint#search-by-ids: articles required (1-100), no searchterm accepted", async () => {
    const unit = await testSealedUnit("opoint#search-by-ids");
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const rejected: Json[] = [
        { params: {} },
        { params: { articles: [] } },
        { searchterm: "x", params: { articles: ARTICLES } },
        { params: { articles: [{ id_site: 11 }] } },
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
