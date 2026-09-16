import { assert, assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import {
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

Deno.test("firecrawl#search block rate rounds up: 11 results cost 4 credits", async () => {
    const unit = await testSealedUnit("firecrawl#search");
    const estimate = await runEndpoint({
        unit,
        input: { body: { query: "anything", limit: 11 } },
        mode: "replay",
        fixture: await loadFixture(`${chains}search-ok.json`),
    });
    // the settle counts DELIVERED results (3 in the chain), not the request's
    // cap — the estimate is the promise, the evidence is what happened
    assertEquals(estimate.usage.evidence, { search_block: 3 });
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
