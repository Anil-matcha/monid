import { assertEquals, assertRejects } from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { Json } from "@shared/core";
import {
    liveSkip,
    loadFixture,
    runEndpoint,
    testBundle,
    testSealedUnit,
} from "@shared/testing";
import { directTransport, Engine } from "@monid/connector-engine";

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));
const ID = "ahrefs#site-explorer/keywords-history";
const INPUT = {
    "queryParams": {
        "target": "ahrefs.com",
        "date_from": "2026-01-01",
        "date_to": "2026-03-31",
    },
};

Deno.test(`${ID} happy (synthetic): 3 row(s) ⇒ max(50, 6 × 3) = 50 units`, async () => {
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
        "evidence": { "rows": 3, "minimum_top_up": 32 },
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
        const bad of [{ "target": "ahrefs.com", "date_from": "2026-01-01" }, {
            "target": "ahrefs.com",
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

/** Live-measured 2026-09-16 (Monid-dev runs on the vendor's free target):
 *  a history row is a bucket ANCHOR inside the range — daily every day,
 *  weekly dated on Mondays, monthly dated on the 1st. 2025-01-31→02-01
 *  returned 2 daily rows and 1 monthly row (dated 02-01); Sun 2025-01-05→
 *  Mon 01-06 returned 1 weekly row (dated 01-06). The estimate must count
 *  those anchors — `ceil(days / 30)` (v1, first draft) held 1 row for
 *  02-01→03-01, where this rule yields 2. */
Deno.test(`${ID} estimate: rows are the bucket anchors in range (live-measured), no IO`, async () => {
    const unit = await testSealedUnit(ID);
    const engine = new Engine({
        transport: directTransport({
            params: () => Promise.resolve({ apiKey: "test-key" }),
            fetch: () => Promise.reject(new Error("estimate must not IO")),
        }),
    });
    const loaded = await engine.load(unit);
    const cases: [string, string, string, number][] = [
        ["daily", "2025-01-31", "2025-02-01", 2],
        ["weekly", "2025-01-05", "2025-01-06", 1], // Sun→Mon: one Monday
        ["weekly", "2025-01-07", "2025-01-12", 0], // Tue→Sun: none
        ["weekly", "2025-01-06", "2025-01-13", 2], // Mon→Mon
        ["monthly", "2025-01-31", "2025-02-01", 1], // one 1st, dated 02-01
        ["monthly", "2025-02-01", "2025-03-01", 2], // ceil(29 / 30) said 1
        ["monthly", "2024-02-01", "2024-03-01", 2], // leap February
        ["monthly", "2025-12-01", "2026-01-01", 2], // year boundary
        ["monthly", "2025-01-02", "2025-01-30", 0], // no 1st inside
        ["monthly", "2026-01-01", "2026-06-30", 6], // v1's test said 7
        ["monthly", "2026-03-01", "2026-01-01", 0], // inverted range
    ];
    for (const [history_grouping, date_from, date_to, rows] of cases) {
        const usage = loaded.estimate({
            queryParams: {
                target: "ahrefs.com",
                date_from,
                date_to,
                history_grouping,
            },
        });
        assertEquals(
            usage,
            {
                credits: { default: Math.max(50, 6 * rows) },
                evidence: { rows, minimum_top_up: Math.max(0, 50 - 6 * rows) },
            },
            `${history_grouping} ${date_from}→${date_to}`,
        );
    }
});

Deno.test("ahrefs#site-explorer/metrics-history reserves 63 units across February, above the minimum", async () => {
    const unit = await testSealedUnit("ahrefs#site-explorer/metrics-history");
    const engine = new Engine({
        transport: directTransport({
            params: () => Promise.resolve({ apiKey: "test-key" }),
            fetch: () => Promise.reject(new Error("estimate must not IO")),
        }),
    });
    const loaded = await engine.load(unit);
    // Three monthly anchors (Feb 1, Mar 1, Apr 1). The old 30-day
    // approximation reserved only 50 units for two rows at 21 units each.
    assertEquals(
        loaded.estimate({
            queryParams: {
                target: "ahrefs.com",
                date_from: "2025-02-01",
                date_to: "2025-04-01",
                // Omitted grouping exercises the compiled monthly default.
            },
        }),
        {
            credits: { default: 63 },
            evidence: { rows: 3, minimum_top_up: 0 },
        },
    );
});

Deno.test(`${ID} estimate is THE grouped-history fn: the six siblings intern to it`, async () => {
    const bundle = await testBundle();
    const key = bundle.endpoints[ID].usage.estimate.$fn.key;
    for (
        const sibling of [
            "domain-rating-history",
            "metrics-history",
            "pages-history",
            "refdomains-history",
            "total-search-volume-history",
            "url-rating-history",
        ]
    ) {
        assertEquals(
            bundle.endpoints[`ahrefs#site-explorer/${sibling}`].usage.estimate
                .$fn.key,
            key,
            sibling,
        );
    }
});
