import { assert, assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { Json } from "@shared/core";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testSealedUnit,
} from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));

Deno.test("opoint#suggest happy (recorded): query → path segments on the public host; rows projected; free", async () => {
    const unit = await testSealedUnit("opoint#suggest");
    // the fixture url IS the wire proof: /single/3/geo%3A0%2Csite%3A0/…/norway
    const fixture = await loadFixture(`${fixturesDir}happy.json`);
    const result = await runEndpoint({
        unit,
        input: {
            queryParams: { query: "norway", types: ["geo", "site"], limit: 3 },
        },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    // FREE model: nothing folds, nothing is evidenced
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals(result.output, {
        results: [
            { type: "geo", id: "1203", name: "Norway", url: "" },
            {
                type: "site",
                id: "3801",
                name: "Greenpeace Norge",
                url: "http://www.greenpeace.org/norway",
            },
        ],
    });
});

Deno.test("opoint#suggest empty (recorded): defaults — 5 rows, all types — reach the path; no rows is a normal success", async () => {
    const unit = await testSealedUnit("opoint#suggest");
    // fixture url: /single/5/0/0/1/nometa/zxqvbnmlkjhgf98765qwe
    const fixture = await loadFixture(`${fixturesDir}empty.json`);
    const result = await runEndpoint({
        unit,
        input: { queryParams: { query: "zxqvbnmlkjhgf98765qwe" } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals(result.output, { results: [] });
});

Deno.test("opoint#suggest: query required, types closed, limit 1-20", async () => {
    const unit = await testSealedUnit("opoint#suggest");
    const fixture = await loadFixture(`${fixturesDir}happy.json`);
    const rejected: Record<string, Json>[] = [
        { q: "norway" },
        { query: "norway", types: ["bogus"] },
        { query: "norway", types: [] },
        { query: "norway", limit: 21 },
    ];
    for (const queryParams of rejected) {
        await assertRejects(
            () =>
                runEndpoint({
                    unit,
                    input: { queryParams },
                    mode: "replay",
                    fixture,
                }),
            Error,
            "INVALID_INPUT",
            JSON.stringify(queryParams),
        );
    }
});

Deno.test({
    name:
        "opoint#suggest live (gated on OPOINT_API_KEY — the host itself takes none)",
    ignore: liveSkip("opoint"),
    fn: async () => {
        const unit = await testSealedUnit("opoint#suggest");
        const result = await runEndpoint({
            unit,
            input: { queryParams: { query: "new york", limit: 2 } },
            mode: "live",
        });
        assertEquals(result.isProviderError, false);
        assertEquals(result.usage, { credits: {}, evidence: {} });
        const rows = (result.output as { results: Record<string, unknown>[] })
            .results;
        // `limit` is a ceiling: the host may know fewer names
        assert(rows.length <= 2, `${rows.length} rows for limit 2`);
        for (const row of rows) {
            assertEquals(Object.keys(row).sort(), [
                "id",
                "name",
                "type",
                "url",
            ]);
        }
    },
});
