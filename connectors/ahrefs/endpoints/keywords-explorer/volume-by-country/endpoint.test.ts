import { assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { Json } from "@shared/core";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testSealedUnit,
} from "@shared/testing";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));
const ID = "ahrefs#keywords-explorer/volume-by-country";
const INPUT = { "queryParams": { "keyword": "seo tools", "limit": 3 } };

Deno.test(`${ID} happy (synthetic): 3 row(s) ⇒ max(50, 11 × 3) = 50 units`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: INPUT,
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.isProviderError, false);
    // no vendor claim ⇒ the derived fold IS usage; zUsage is strict, so
    // deep equality proves there is no `mismatch` key
    assertEquals(result.usage, {
        "credits": { "default": 50 },
        "evidence": { "rows": 3, "minimum_top_up": 17 },
    });
});

Deno.test(`${ID} empty (synthetic): zero rows still draws the 50-unit request minimum`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-empty.json`);
    const result = await runEndpoint({
        unit,
        input: INPUT,
        mode: "replay",
        fixture,
    });
    assertEquals(result.isProviderError, false);
    assertEquals(result.usage, {
        "credits": { "default": 50 },
        "evidence": { "rows": 0, "minimum_top_up": 50 },
    });
});

Deno.test(`${ID} provider error (synthetic 400): data, zero usage, digested envelope`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(
        `${fixturesDir}synthetic-provider-error.json`,
    );
    const result = await runEndpoint({
        unit,
        input: INPUT,
        mode: "replay",
        fixture,
    });
    assertEquals(result.isProviderError, true);
    assertEquals(result.httpStatus, 400);
    assertEquals(result.usage, { credits: {}, evidence: {} });
    assertEquals(
        (result.output as Record<string, unknown>).message,
        "invalid filter",
    );
});

Deno.test(`${ID} schema gate: bad inputs are rejected before the wire`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    for (
        const bad of [{ "keyword": "seo tools" }, {
            "keyword": "seo tools",
            "limit": 251,
        }] as Record<string, Json>[]
    ) {
        await assertRejects(
            () =>
                runEndpoint({
                    unit,
                    input: { queryParams: bad },
                    mode: "replay",
                    fixture,
                }),
            Error,
            "INVALID_INPUT",
            JSON.stringify(bad),
        );
    }
});

Deno.test({
    name: `${ID} live (gated on AHREFS_API_KEY; draws at least 50 units)`,
    ignore: liveSkip("ahrefs"),
    fn: async () => {
        const unit = await testSealedUnit(ID);
        const result = await runEndpoint({ unit, input: INPUT, mode: "live" });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        // shape only — the row count is the vendor's
        assertEquals(typeof result.usage.evidence.rows, "number");
    },
});
