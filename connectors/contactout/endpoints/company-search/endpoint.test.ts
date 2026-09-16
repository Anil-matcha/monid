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
const ID = "contactout#v1/company/search";

Deno.test(`${ID} happy (synthetic, companies as an ARRAY): one company ⇒ 1 search credit`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    const result = await runEndpoint({
        unit,
        input: { body: { name: ["ContactOut"] } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.httpStatus, 200);
    assertEquals(result.usage, {
        credits: { search_work: 1 },
        evidence: { RESULT: 1 },
    });
});

Deno.test(`${ID} empty (synthetic): zero companies draw nothing`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-empty.json`);
    const result = await runEndpoint({
        unit,
        input: { body: { name: ["No Such Company Zzz"] } },
        mode: "replay",
        fixture,
    });
    assertEquals(result.usage, { credits: {}, evidence: { RESULT: 0 } });
});

Deno.test(`${ID} schema gate: unknown keys and out-of-vocabulary sizes are rejected`, async () => {
    const unit = await testSealedUnit(ID);
    const fixture = await loadFixture(`${fixturesDir}synthetic-happy.json`);
    for (
        const bad of [
            { name: ["ContactOut"], page_size: 10 },
            { size: ["huge"] },
            { year_founded_from: 1900 },
        ] as Record<string, Json>[]
    ) {
        await assertRejects(
            () =>
                runEndpoint({
                    unit,
                    input: { body: bad },
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
    name: `${ID} live (gated on CONTACTOUT_CREDENTIALS)`,
    ignore: liveSkip("contactout"),
    fn: async () => {
        const unit = await testSealedUnit(ID);
        const result = await runEndpoint({
            unit,
            input: { body: { domain: ["contactout.com"] } },
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
    },
});
