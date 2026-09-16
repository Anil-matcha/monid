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

const fixturesDir = fromFileUrl(new URL("./fixtures/", import.meta.url));
const ID = "ahrefs#site-explorer/all-backlinks";
const INPUT = { "queryParams": { "target": "ahrefs.com", "limit": 3 } };

const UNITS_PER_ROW: Record<string, number> = {
    "ahrefs#site-explorer/all-backlinks": 10,
    "ahrefs#site-explorer/broken-backlinks": 9,
    "ahrefs#site-explorer/refdomains": 6,
    "ahrefs#site-explorer/anchors": 9,
    "ahrefs#site-explorer/organic-keywords": 24,
    "ahrefs#site-explorer/organic-competitors": 14,
    "ahrefs#site-explorer/top-pages": 23,
    "ahrefs#site-explorer/paid-pages": 13,
    "ahrefs#site-explorer/crawled-pages": 6,
    "ahrefs#site-explorer/linkeddomains": 4,
    "ahrefs#site-explorer/linked-anchors-external": 5,
    "ahrefs#site-explorer/linked-anchors-internal": 4,
    "ahrefs#site-explorer/pages-by-backlinks": 8,
    "ahrefs#site-explorer/pages-by-internal-links": 3,
    "ahrefs#site-explorer/metrics-by-country": 23,
    "ahrefs#site-explorer/domain-rating": 2,
    "ahrefs#site-explorer/backlinks-stats": 12,
    "ahrefs#site-explorer/metrics": 44,
    "ahrefs#site-explorer/outlinks-stats": 4,
    "ahrefs#site-explorer/pages-by-traffic": 56,
    "ahrefs#site-explorer/ai-responses-count": 120,
    "ahrefs#site-explorer/domain-rating-history": 2,
    "ahrefs#site-explorer/url-rating-history": 2,
    "ahrefs#site-explorer/pages-history": 2,
    "ahrefs#site-explorer/refdomains-history": 6,
    "ahrefs#site-explorer/metrics-history": 21,
    "ahrefs#site-explorer/keywords-history": 6,
    "ahrefs#site-explorer/total-search-volume-history": 11,
    "ahrefs#keywords-explorer/overview": 42,
    "ahrefs#keywords-explorer/matching-terms": 22,
    "ahrefs#keywords-explorer/related-terms": 22,
    "ahrefs#keywords-explorer/search-suggestions": 12,
    "ahrefs#keywords-explorer/volume-history": 2,
    "ahrefs#keywords-explorer/volume-by-country": 11,
    "ahrefs#serp-overview/serp-overview": 20,
    "ahrefs#batch-analysis/batch-analysis": 21,
};

Deno.test("ahrefs: the units-per-row literals — one line per doc, the vendor OpenAPI field costs (v1 UNITS_PER_ROW, drill-verified 2026-08)", async () => {
    const bundle = await testBundle();
    const ids = Object.keys(bundle.endpoints).filter((id) =>
        id.startsWith("ahrefs#")
    ).sort();
    // a new endpoint must state its measured units here
    assertEquals(ids, Object.keys(UNITS_PER_ROW).sort());
    const evidenceKeys = new Set<string>();
    for (const id of ids) {
        const doc = bundle.endpoints[id];
        assertEquals(doc.usage.consolidate, undefined, id);
        assertEquals(Object.keys(doc.usage.credits), ["default"], id);
        const model = doc.usage.model as {
            kind: string;
            components?: Record<
                string,
                { consumes: { credit: string; amount: number } }
            >;
        };
        assertEquals(model.kind, "COMPOSITE", id);
        // no vendor claim exists, so the derived fold IS usage — the table
        // is the only thing between a typo and a wrong bill (clay D7a)
        assertEquals(
            model.components!.rows.consumes.amount,
            UNITS_PER_ROW[id],
            id,
        );
        assertEquals(model.components!.minimum_top_up.consumes.amount, 1, id);
        evidenceKeys.add(doc.usage.evidence.$fn.key);
    }
    // the generic rows counter is stated verbatim everywhere ⇒ ONE fn
    assertEquals(evidenceKeys.size, 1);
});

Deno.test(`${ID} happy (synthetic): 3 row(s) ⇒ max(50, 10 × 3) = 50 units`, async () => {
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
        "evidence": { "rows": 3, "minimum_top_up": 20 },
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
        const bad of [
            { "target": "ahrefs.com" },
            { "target": "ahrefs.com", "limit": 101 },
            {
                "target": "ahrefs.com",
                "limit": 3,
                "where": '{"field":"traffic","is":["gt",100]}',
            },
            { "target": "ahrefs.com", "limit": 3, "order_by": "traffic" },
            { "target": "ahrefs.com", "limit": 3, "order_by": "first_seen:up" },
        ] as Record<string, Json>[]
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
