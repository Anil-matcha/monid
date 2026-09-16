import { assert, assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { RunInput } from "@shared/core";
import {
    estimateEndpoint,
    liveSkip,
    loadFixture,
    runEndpoint,
    testSealedUnit,
} from "@shared/testing";

const chains = fromFileUrl(new URL("../../fixtures/", import.meta.url));

Deno.test("firecrawl#search happy: block rate agrees with the vendor receipt, which is plucked away", async () => {
    const unit = await testSealedUnit("firecrawl#search");
    const result = await runEndpoint({
        unit,
        input: { body: { query: "deno workspace monorepo", limit: 3 } },
        mode: "replay",
        fixture: await loadFixture(`${chains}search-ok.json`),
    });

    assertEquals(result.httpStatus, 200);
    // 3 results -> ceil(3/10) x 2 = 2 credits, matching the vendor's claim
    assertEquals(result.usage, {
        credits: { default: 2 },
        evidence: { search_block: 3 },
    });
    assertEquals(result.usage.mismatch, undefined);
    // the bare top-level receipt is a billing fact, not data — plucked out
    const output = result.output as Record<string, unknown>;
    assertEquals("creditsUsed" in output, false);
    assertEquals(
        (output.data as Record<string, unknown[]>).web.length,
        3,
    );
});

Deno.test("firecrawl#search: `limit` is required — the caller states the cap", async () => {
    const unit = await testSealedUnit("firecrawl#search");
    const required = unit.doc.input.schema.body?.required as string[];
    assert(
        required.includes("limit"),
        "limit is the primary limiting knob and must be required at the binding",
    );
    assert(required.includes("query"));
});

Deno.test("firecrawl#search estimate: the block rate rounds up — 11 results cost 4", async () => {
    const unit = await testSealedUnit("firecrawl#search");
    assertEquals(
        (await estimateEndpoint(unit, { body: { query: "x", limit: 10 } }))
            .credits,
        { default: 2 },
    );
    assertEquals(
        (await estimateEndpoint(unit, { body: { query: "x", limit: 11 } }))
            .credits,
        { default: 4 },
    );
});

Deno.test("firecrawl#search estimate: `limit` is PER SOURCE, so sources multiply the promise", async () => {
    const unit = await testSealedUnit("firecrawl#search");
    // verified live 2026-09-16: limit 10 over [web] returned 10 results for 2
    // credits; the same limit over [web, news, images] returned 30 for 6
    const three = await estimateEndpoint(unit, {
        body: { query: "x", limit: 10, sources: ["web", "news", "images"] },
    });
    assertEquals(three.credits, { default: 6 });
    assertEquals(three.evidence, { search_block: 30 });

    // the object spelling must price identically to the string one
    const objects = await estimateEndpoint(unit, {
        body: {
            query: "x",
            limit: 10,
            sources: [{ type: "web" }, { type: "news" }, { type: "images" }],
        },
    });
    assertEquals(objects.credits, three.credits);

    // DISTINCT sources: the response is keyed by source name, so a repeated
    // entry cannot yield a second result array and must not inflate the hold
    const duplicated = await estimateEndpoint(unit, {
        body: { query: "x", limit: 10, sources: ["web", "web"] },
    });
    assertEquals(duplicated.credits, { default: 2 });

    // categories FILTER the same result set — they never multiply it
    const filtered = await estimateEndpoint(unit, {
        body: { query: "x", limit: 10, categories: ["research"] },
    });
    assertEquals(filtered.credits, { default: 2 });
});

Deno.test("firecrawl#search: both vendor spellings of sources/categories validate", async () => {
    const unit = await testSealedUnit("firecrawl#search");
    // Firecrawl accepts bare strings AND objects (live probe 2026-09-16); a
    // mirror that rejected the string form would fail the request locally,
    // before it ever reached a vendor that would have answered it
    const bodies: RunInput["body"][] = [
        { query: "x", limit: 3, sources: ["web"] },
        { query: "x", limit: 3, sources: [{ type: "web", tbs: "qdr:d" }] },
        { query: "x", limit: 3, categories: ["research"] },
        { query: "x", limit: 3, categories: [{ type: "research" }] },
    ];
    for (const body of bodies) {
        const result = await runEndpoint({
            unit,
            input: { body },
            mode: "replay",
            fixture: await loadFixture(`${chains}search-ok.json`),
        });
        assertEquals(result.isProviderError, false, JSON.stringify(body));
    }
});

Deno.test("firecrawl#search settle: evidence counts DELIVERED results, not the cap", async () => {
    const unit = await testSealedUnit("firecrawl#search");
    const result = await runEndpoint({
        unit,
        input: { body: { query: "anything", limit: 11 } },
        mode: "replay",
        fixture: await loadFixture(`${chains}search-ok.json`),
    });
    // the chain delivers 3 — the estimate promised 11, and the two are
    // allowed to differ: a promise is not a receipt
    assertEquals(result.usage.evidence, { search_block: 3 });
});

Deno.test("firecrawl#search provider error: 402 is data, zero usage", async () => {
    const unit = await testSealedUnit("firecrawl#search");
    const result = await runEndpoint({
        unit,
        input: { body: { query: "anything", limit: 10 } },
        mode: "replay",
        fixture: await loadFixture(`${chains}provider-error.json`),
    });

    assertEquals(result.httpStatus, 402);
    assertEquals(result.isProviderError, true);
    assertEquals(result.usage, { credits: {}, evidence: {} });
});

Deno.test({
    name: "firecrawl#search live (gated on FIRECRAWL_API_KEY)",
    ignore: liveSkip("firecrawl"),
    fn: async () => {
        const unit = await testSealedUnit("firecrawl#search");
        const result = await runEndpoint({
            unit,
            input: { body: { query: "deno 2 workspace guide", limit: 3 } },
            mode: "live",
        });
        assertEquals(
            result.isProviderError,
            false,
            JSON.stringify(result.output),
        );
        assertEquals(result.usage.credits.default, 2);
        assert(!("creditsUsed" in (result.output as Record<string, unknown>)));
    },
});
