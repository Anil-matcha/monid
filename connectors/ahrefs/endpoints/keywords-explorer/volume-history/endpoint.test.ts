import { assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { Json } from "@shared/core";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testSealedUnit,
} from "@shared/testing";
import { directTransport, Engine } from "@monid/connector-engine";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));
const ID = "ahrefs#keywords-explorer/volume-history";
const INPUT = {
    "queryParams": {
        "country": "us",
        "keyword": "seo tools",
        "date_from": "2026-01-01",
        "date_to": "2026-03-31",
    },
};

Deno.test(`${ID} happy (synthetic): 3 row(s) ⇒ max(50, 2 × 3) = 50 units`, async () => {
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
        "evidence": { "rows": 3, "minimum_top_up": 44 },
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
        const bad of [{
            "country": "us",
            "keyword": "seo tools",
            "date_from": "2026-01-01",
        }, {
            "country": "us",
            "keyword": "seo tools",
            "date_from": "2026/01/01",
            "date_to": "2026-03-31",
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

/** Live-measured 2026-09-16 (Monid-dev run on the vendor's free keyword):
 *  2025-01-31→02-01 returned ONE row, dated 2025-02-01 — monthly rows
 *  are anchored on the 1st, so the estimate counts the 1sts in range. */
Deno.test(`${ID} estimate: rows are the 1st-of-month anchors in range (live-measured), no IO`, async () => {
    const unit = await testSealedUnit(ID);
    const engine = new Engine({
        transport: directTransport({
            params: () => Promise.resolve({ apiKey: "test-key" }),
            fetch: () => Promise.reject(new Error("estimate must not IO")),
        }),
    });
    const loaded = await engine.load(unit);
    const cases: [string, string, number][] = [
        ["2025-01-31", "2025-02-01", 1], // the live case
        ["2025-02-01", "2025-03-01", 2], // ceil(29 / 30) said 1
        ["2024-02-01", "2024-03-01", 2], // leap February
        ["2025-12-01", "2026-01-01", 2], // year boundary
        ["2025-01-02", "2025-01-30", 0], // no 1st inside
        ["2026-01-01", "2026-03-31", 3], // the fixture's range
        ["2026-03-01", "2026-01-01", 0], // inverted range
    ];
    for (const [date_from, date_to, rows] of cases) {
        const usage = loaded.estimate({
            queryParams: {
                keyword: "seo tools",
                country: "us",
                date_from,
                date_to,
            },
        });
        assertEquals(
            usage,
            {
                credits: { default: Math.max(50, 2 * rows) },
                evidence: { rows, minimum_top_up: Math.max(0, 50 - 2 * rows) },
            },
            `${date_from}→${date_to}`,
        );
    }
});
